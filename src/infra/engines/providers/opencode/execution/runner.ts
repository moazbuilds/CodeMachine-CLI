import * as path from 'node:path';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildOpenCodeRunCommand } from './commands.js';
import { metadata } from '../metadata.js';
import { resolveOpenCodeHome } from '../auth.js';
import { ENV } from '../config.js';
import { formatCommand, formatResult, formatStatus, formatMessage } from '../../../../../shared/formatters/outputMarkers.js';
import { logger } from '../../../../../shared/logging/index.js';
import { createTelemetryCapture } from '../../../../../shared/telemetry/index.js';
import type { ParsedTelemetry } from '../../../core/types.js';

export interface RunOpenCodeOptions {
  prompt: string;
  workingDir: string;
  resumeSessionId?: string;
  resumePrompt?: string;
  model?: string;
  agent?: string;
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  onTelemetry?: (telemetry: ParsedTelemetry) => void;
  onSessionId?: (sessionId: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
}

export interface RunOpenCodeResult {
  stdout: string;
  stderr: string;
}

/**
 * Build the final resume prompt - just pass through the prompt as-is
 * The caller (controller.ts) is responsible for building the proper message
 */
function buildResumePrompt(userPrompt?: string): string {
  return userPrompt || 'Continue.';
}

function shouldApplyDefault(key: string, overrides?: NodeJS.ProcessEnv): boolean {
  return overrides?.[key] === undefined && process.env[key] === undefined;
}

function resolveRunnerEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const runnerEnv: NodeJS.ProcessEnv = { ...process.env, ...(env ?? {}) };

  // Set all three XDG environment variables to subdirectories under OPENCODE_HOME
  // This centralizes all OpenCode data under ~/.codemachine/opencode by default
  const opencodeHome = resolveOpenCodeHome(runnerEnv[ENV.OPENCODE_HOME]);

  if (shouldApplyDefault('XDG_CONFIG_HOME', env)) {
    runnerEnv.XDG_CONFIG_HOME = path.join(opencodeHome, 'config');
  }

  if (shouldApplyDefault('XDG_CACHE_HOME', env)) {
    runnerEnv.XDG_CACHE_HOME = path.join(opencodeHome, 'cache');
  }

  if (shouldApplyDefault('XDG_DATA_HOME', env)) {
    runnerEnv.XDG_DATA_HOME = path.join(opencodeHome, 'data');
  }

  return runnerEnv;
}

const truncate = (value: string, length = 100): string =>
  value.length > length ? `${value.slice(0, length)}...` : value;

function formatToolUse(part: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partObj = (typeof part === 'object' && part !== null ? part : {}) as Record<string, any>;
  const tool = partObj?.tool ?? 'tool';
  const base = formatCommand(tool, 'success');
  const state = partObj?.state ?? {};

  if (tool === 'bash') {
    const outputRaw =
      typeof state?.output === 'string'
        ? state.output
        : state?.output
          ? JSON.stringify(state.output)
          : '';
    const output = outputRaw?.trim() ?? '';
    if (output) {
      return `${base}\n${formatResult(output, false)}`;
    }
    return base;
  }

  const previewSource =
    (typeof state?.title === 'string' && state.title.trim()) ||
    (typeof state?.output === 'string' && state.output.trim()) ||
    (state?.input && Object.keys(state.input).length > 0 ? JSON.stringify(state.input) : '');

  if (previewSource) {
    const preview = previewSource.trim();
    return `${base}\n${formatResult(truncate(preview), false)}`;
  }

  return base;
}

function formatStepEvent(type: string, part: unknown): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partObj = (typeof part === 'object' && part !== null ? part : {}) as Record<string, any>;
  const reason = typeof partObj?.reason === 'string' ? partObj.reason : undefined;

  // Only show final step (reason: 'stop'), skip intermediate steps (reason: 'tool-calls')
  if (reason !== 'stop') {
    return null;
  }

  const tokens = partObj?.tokens;
  if (!tokens) {
    return null;
  }

  const cache = (tokens.cache?.read ?? 0) + (tokens.cache?.write ?? 0);
  const totalIn = (tokens.input ?? 0) + cache;
  const tokenSummary = `⏱️  Tokens: ${totalIn}in/${tokens.output ?? 0}out${cache > 0 ? ` (${cache} cached)` : ''}`;

  return tokenSummary;
}

function formatErrorEvent(error: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorObj = (typeof error === 'object' && error !== null ? error : {}) as Record<string, any>;
  const dataMessage =
    typeof errorObj?.data?.message === 'string'
      ? errorObj.data.message
      : typeof errorObj?.message === 'string'
        ? errorObj.message
        : typeof errorObj?.name === 'string'
          ? errorObj.name
          : 'OpenCode reported an unknown error';

  return `${formatCommand('OpenCode Error', 'error')}\n${formatResult(dataMessage, true)}`;
}

export async function runOpenCode(options: RunOpenCodeOptions): Promise<RunOpenCodeResult> {
  const {
    prompt,
    workingDir,
    resumeSessionId,
    resumePrompt,
    model,
    agent,
    env,
    onData,
    onErrorData,
    onTelemetry,
    onSessionId,
    abortSignal,
    timeout = 1800000,
  } = options;

  if (!prompt) {
    throw new Error('runOpenCode requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runOpenCode requires a working directory.');
  }

  const runnerEnv = resolveRunnerEnv(env);
  const { command, args } = buildOpenCodeRunCommand({ model, agent, resumeSessionId });

  logger.debug(
    `OpenCode runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}, agent: ${
      agent ?? 'build'
    }, model: ${model ?? 'default'}`,
  );

  const telemetryCapture = createTelemetryCapture('opencode', model, prompt, workingDir);
  let jsonBuffer = '';
  let stderrBuffer = '';
  let capturedError: string | null = null;
  let isFirstStep = true;
  let sessionIdCaptured = false;

  const processLine = (line: string): void => {
    if (!line.trim()) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }

    telemetryCapture.captureFromStreamJson(line);

    if (onTelemetry) {
      const captured = telemetryCapture.getCaptured();
      if (captured?.tokens) {
        onTelemetry({
          tokensIn: captured.tokens.input ?? 0,
          tokensOut: captured.tokens.output ?? 0,
          cached: captured.tokens.cached,
          cost: captured.cost,
          duration: captured.duration,
        });
      }
    }

    // Type guard for parsed JSON
    if (typeof parsed !== 'object' || parsed === null) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsedObj = parsed as Record<string, any>;

    // Capture session ID from first event that contains it
    if (!sessionIdCaptured && parsedObj.sessionID && onSessionId) {
      sessionIdCaptured = true;
      logger.debug(`[SESSION_ID CAPTURED] ${parsedObj.sessionID}`);
      onSessionId(parsedObj.sessionID);
    }

    let formatted: string | null = null;
    switch (parsedObj.type) {
      case 'tool_use':
        formatted = formatToolUse(parsedObj.part);
        break;
      case 'step_start':
        if (isFirstStep) {
          isFirstStep = false;
          formatted = formatStatus('OpenCode is analyzing your request...');
        }
        // Subsequent step_start events are silent
        break;
      case 'step_finish':
        formatted = formatStepEvent(parsedObj.type, parsedObj.part);
        break;
      case 'text': {
        const textPart = parsedObj.part;
        const rawText = typeof textPart?.text === 'string' ? textPart.text : '';
        // Strip leading newlines - OpenCode adds these for terminal formatting
        // which we handle ourselves via formatMessage
        const textValue = rawText.replace(/^\n+/, '');
        // Only format if text has non-whitespace content
        formatted = textValue.trim() ? formatMessage(textValue) : null;
        break;
      }
      case 'error':
        formatted = formatErrorEvent(parsedObj.error);
        // Capture error for later (OpenCode may exit 0 even on errors)
        if (!capturedError && parsedObj.error) {
          const errorObj = parsedObj.error as Record<string, unknown>;
          capturedError = (errorObj.data as Record<string, unknown>)?.message as string
            ?? errorObj.message as string
            ?? errorObj.name as string
            ?? 'Unknown error';
        }
        break;
      default:
        break;
    }

    if (formatted) {
      const suffix = formatted.endsWith('\n') ? '' : '\n';
      onData?.(formatted + suffix);
    }
  };

  const normalizeChunk = (chunk: string): string => {
    let result = chunk;

    // Convert line endings to \n
    result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Handle carriage returns that cause line overwrites
    result = result.replace(/^.*\r([^\r\n]*)/gm, '$1');

    // Collapse excessive newlines
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
  };

  let result;
  try {
    result = await spawnProcess({
      command,
      args,
      cwd: workingDir,
      env: runnerEnv,
      stdinInput: resumeSessionId ? buildResumePrompt(resumePrompt) : prompt,
      stdioMode: 'pipe',
      onStdout: (chunk) => {
        const normalized = normalizeChunk(chunk);
        jsonBuffer += normalized;

        const lines = jsonBuffer.split('\n');
        jsonBuffer = lines.pop() ?? '';

        for (const line of lines) {
          processLine(line);
        }
      },
      onStderr: (chunk) => {
        const normalized = normalizeChunk(chunk);
        stderrBuffer += normalized;
        onErrorData?.(normalized);
      },
      signal: abortSignal,
      timeout,
    });
  } catch (error) {
    const err = error as { code?: string; message?: string };
    const message = err?.message ?? '';
    const notFound =
      err?.code === 'ENOENT' ||
      /not recognized as an internal or external command/i.test(message) ||
      /command not found/i.test(message);

    if (notFound) {
      const installMessage = [
        `'${command}' is not available on this system.`,
        'Install OpenCode via:',
        '  npm i -g opencode-ai@latest',
        '  brew install opencode',
        '  scoop bucket add extras && scoop install extras/opencode',
        '  choco install opencode',
        'Docs: https://opencode.ai/docs',
      ].join('\n');
      logger.error(`${metadata.name} CLI not found when executing: ${command} ${args.join(' ')}`);
      throw new Error(installMessage);
    }

    throw error;
  }

  if (jsonBuffer.trim()) {
    processLine(jsonBuffer);
    jsonBuffer = '';
  }

  const stderr = stderrBuffer.trim() || result.stderr.trim();
  const stdout = result.stdout.trim();

  // OpenCode may exit with code 0 even on errors (e.g., invalid model)
  // Detect: 1) JSON error event captured, 2) no stdout but has stderr = startup failure
  const isStartupError = !stdout && stderr;

  if (result.exitCode !== 0 || capturedError || isStartupError) {
    const sample = (stderr || stdout || 'no error output').split('\n').slice(0, 10).join('\n');

    logger.error('OpenCode CLI execution failed', {
      exitCode: result.exitCode,
      sample,
      command: `${command} ${args.join(' ')}`,
    });

    // Use captured JSON error, fall back to stderr
    const errorMessage = capturedError || stderr || `exited with code ${result.exitCode}`;
    throw new Error(errorMessage);
  }

  telemetryCapture.logCapturedTelemetry(result.exitCode);

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
