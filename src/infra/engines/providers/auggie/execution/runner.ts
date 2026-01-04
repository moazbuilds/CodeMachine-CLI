import { spawnProcess } from '../../../../process/spawn.js';
import { buildAuggieRunCommand } from './commands.js';
import { metadata } from '../metadata.js';
import { resolveAuggieHome } from '../auth.js';
import { ENV } from '../config.js';
import { formatCommand, formatResult, formatStatus, formatMessage } from '../../../../../shared/formatters/outputMarkers.js';
import { logger } from '../../../../../shared/logging/index.js';
import { createTelemetryCapture } from '../../../../../shared/telemetry/index.js';
import type { ParsedTelemetry } from '../../../core/types.js';

export interface RunAuggieOptions {
  prompt: string;
  workingDir: string;
  resumeSessionId?: string;
  resumePrompt?: string;
  model?: string;
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  onTelemetry?: (telemetry: ParsedTelemetry) => void;
  onSessionId?: (sessionId: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
}

export interface RunAuggieResult {
  stdout: string;
  stderr: string;
}

function shouldApplyDefault(key: string, overrides?: NodeJS.ProcessEnv): boolean {
  return overrides?.[key] === undefined && process.env[key] === undefined;
}

function resolveRunnerEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const runnerEnv: NodeJS.ProcessEnv = { ...process.env, ...(env ?? {}) };

  // Set Auggie home directory
  const auggieHome = resolveAuggieHome(runnerEnv[ENV.AUGGIE_HOME]);

  if (shouldApplyDefault('AUGMENT_HOME', env)) {
    runnerEnv.AUGMENT_HOME = auggieHome;
  }

  return runnerEnv;
}

/**
 * Build the final resume prompt combining steering instruction with user message
 */
function buildResumePrompt(userPrompt?: string): string {
  const defaultPrompt = 'Continue from where you left off.';

  if (!userPrompt) {
    return defaultPrompt;
  }

  // Combine steering instruction with user's message
  return `[USER STEERING] The user paused this session to give you new direction. Continue from where you left off, but prioritize the user's request: "${userPrompt}"`;
}

// Note: Auggie returns a single result object, not streaming events like OpenCode
// Therefore, we don't need complex formatting helpers like formatToolUse or formatStepEvent

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
          : 'Auggie reported an unknown error';

  return `${formatCommand('Auggie Error', 'error')}\n${formatResult(dataMessage, true)}`;
}

export async function runAuggie(options: RunAuggieOptions): Promise<RunAuggieResult> {
  const {
    prompt,
    workingDir,
    resumeSessionId,
    resumePrompt,
    model,
    env,
    onData,
    onErrorData,
    onTelemetry,
    onSessionId,
    abortSignal,
    timeout = 1800000,
  } = options;

  if (!prompt) {
    throw new Error('runAuggie requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runAuggie requires a working directory.');
  }

  const runnerEnv = resolveRunnerEnv(env);
  const { command, args } = buildAuggieRunCommand({ model, resumeSessionId });

  // Add working directory to args (Auggie uses --workspace-root, not --cwd)
  args.push('--workspace-root', workingDir);

  // When resuming, use the resume prompt instead of the original prompt
  const effectivePrompt = resumeSessionId ? buildResumePrompt(resumePrompt) : prompt;

  // Add prompt as positional argument (Auggie accepts it as the last argument)
  args.push(effectivePrompt);

  logger.debug(
    `Auggie runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}, model: ${
      model ?? 'default'
    }`,
  );

  const telemetryCapture = createTelemetryCapture('auggie', model, prompt, workingDir);
  let jsonBuffer = '';
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

    // Type guard for parsed JSON
    if (typeof parsed !== 'object' || parsed === null) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsedObj = parsed as Record<string, any>;

    // Auggie returns a single JSON object with type "result"
    // Format: {"type":"result","result":"...","is_error":false,"subtype":"success","session_id":"...","num_turns":0}
    if (parsedObj.type === 'result') {
      // Capture session ID from result event
      if (!sessionIdCaptured && parsedObj.session_id && onSessionId) {
        sessionIdCaptured = true;
        onSessionId(parsedObj.session_id);
      }

      const resultText = typeof parsedObj.result === 'string' ? parsedObj.result : '';
      const isError = parsedObj.is_error === true;

      if (isFirstStep) {
        isFirstStep = false;
        const statusMsg = formatStatus('Auggie is processing your request...');
        onData?.(statusMsg + '\n');
      }

      if (resultText) {
        const formatted = isError ? formatErrorEvent(resultText) : formatMessage(resultText);
        if (formatted) {
          const suffix = formatted.endsWith('\n') ? '' : '\n';
          onData?.(formatted + suffix);
        }
      }

      // Note: Auggie doesn't provide token telemetry in the result
      // If telemetry becomes available in future versions, parse it here
      return;
    }

    // Fallback: Try to capture telemetry if Auggie adds streaming support in the future
    telemetryCapture.captureFromStreamJson(line);

    if (onTelemetry) {
      const captured = telemetryCapture.getCaptured();
      if (captured?.tokens) {
        const totalIn =
          (captured.tokens.input ?? 0) + (captured.tokens.cached ?? 0);
        onTelemetry({
          tokensIn: totalIn,
          tokensOut: captured.tokens.output ?? 0,
          cached: captured.tokens.cached,
          cost: captured.cost,
          duration: captured.duration,
        });
      }
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
        'Install Auggie via:',
        '  npm install -g @augmentcode/auggie',
        'Docs: https://docs.augmentcode.com/cli/overview',
      ].join('\n');
      logger.error(`${metadata.name} not found when executing: ${command} ${args.join(' ')}`);
      throw new Error(installMessage);
    }

    throw error;
  }

  if (jsonBuffer.trim()) {
    processLine(jsonBuffer);
    jsonBuffer = '';
  }

  if (result.exitCode !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    const sample = (stderr || stdout || 'no error output').split('\n').slice(0, 10).join('\n');

    logger.error('Auggie CLI execution failed', {
      exitCode: result.exitCode,
      sample,
      command: `${command} ${args.join(' ')}`,
    });

    throw new Error(`Auggie CLI exited with code ${result.exitCode}`);
  }

  telemetryCapture.logCapturedTelemetry(result.exitCode);

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

