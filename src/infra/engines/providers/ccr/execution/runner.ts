import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildCcrExecCommand } from './commands.js';
import { metadata } from '../metadata.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { logger } from '../../../../../shared/logging/index.js';
import { createTelemetryCapture } from '../../../../../shared/telemetry/index.js';
import { formatThinking, formatCommand, formatResult } from '../../../../../shared/formatters/outputMarkers.js';

export interface RunCcrOptions {
  prompt: string;
  workingDir: string;
  model?: string;
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
}

export interface RunCcrResult {
  stdout: string;
  stderr: string;
}

const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');

// Track tool names for associating with results
const toolNameMap = new Map<string, string>();

/**
 * Formats a CCR stream-json line for display
 */
function formatStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    if (json.type === 'assistant' && json.message?.content) {
      for (const content of json.message.content) {
        if (content.type === 'text') {
          return content.text;
        } else if (content.type === 'thinking') {
          return formatThinking(content.text);
        } else if (content.type === 'tool_use') {
          // Track tool name for later use with result
          if (content.id && content.name) {
            toolNameMap.set(content.id, content.name);
          }
          const commandName = content.name || 'tool';
          return formatCommand(commandName, 'started');
        }
      }
    } else if (json.type === 'user' && json.message?.content) {
      for (const content of json.message.content) {
        if (content.type === 'tool_result') {
          // Get tool name from map
          const toolName = content.tool_use_id ? toolNameMap.get(content.tool_use_id) : undefined;
          const commandName = toolName || 'tool';

          // Clean up the map entry
          if (content.tool_use_id) {
            toolNameMap.delete(content.tool_use_id);
          }

          let preview: string;
          if (content.is_error) {
            preview = typeof content.content === 'string' ? content.content : JSON.stringify(content.content);
            // Show command in red with nested error
            return formatCommand(commandName, 'error') + '\n' + formatResult(preview, true);
          } else {
            if (typeof content.content === 'string') {
              const trimmed = content.content.trim();
              preview = trimmed
                ? (trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed)
                : 'empty';
            } else {
              preview = JSON.stringify(content.content);
            }
            // Show command in green with nested result
            return formatCommand(commandName, 'success') + '\n' + formatResult(preview, false);
          }
        }
      }
    } else if (json.type === 'result') {
      // Calculate total input tokens (non-cached + cached)
      const cacheRead = json.usage.cache_read_input_tokens || 0;
      const cacheCreation = json.usage.cache_creation_input_tokens || 0;
      const totalCached = cacheRead + cacheCreation;
      const totalIn = json.usage.input_tokens + totalCached;

      // Show total input tokens with optional cached indicator
      const tokensDisplay = totalCached > 0
        ? `${totalIn}in/${json.usage.output_tokens}out (${totalCached} cached)`
        : `${totalIn}in/${json.usage.output_tokens}out`;

      return `⏱️  Duration: ${json.duration_ms}ms | Cost: $${json.total_cost_usd} | Tokens: ${tokensDisplay}`;
    }

    return null;
  } catch {
    return null;
  }
}

export async function runCcr(options: RunCcrOptions): Promise<RunCcrResult> {
  const { prompt, workingDir, model, env, onData, onErrorData, abortSignal, timeout = 1800000 } = options;

  if (!prompt) {
    throw new Error('runCcr requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runCcr requires a working directory.');
  }

  // Set up CCR_CONFIG_DIR for authentication
  const ccrConfigDir = process.env.CCR_CONFIG_DIR
    ? expandHomeDir(process.env.CCR_CONFIG_DIR)
    : path.join(homedir(), '.codemachine', 'ccr');

  const mergedEnv = {
    ...process.env,
    ...(env ?? {}),
    CCR_CONFIG_DIR: ccrConfigDir,
  };

  const plainLogs = (process.env.CODEMACHINE_PLAIN_LOGS || '').toString() === '1';
  // Force pipe mode to ensure text normalization is applied
  const inheritTTY = false;

  const normalize = (text: string): string => {
    // Simple but effective approach to fix carriage return wrapping issues
    let result = text;

    // Handle carriage returns that cause line overwrites
    // When we see \r followed by text, it means the text should overwrite what came before
    // So we keep only the text after the last \r in each line
    result = result.replace(/^.*\r([^\r\n]*)/gm, '$1');

    if (plainLogs) {
      // Plain mode: strip all ANSI sequences
      result = result.replace(ANSI_ESCAPE_SEQUENCE, '');
    }

    // Clean up line endings
    result = result
      .replace(/\r\n/g, '\n')  // Convert CRLF to LF
      .replace(/\r/g, '\n')    // Convert remaining CR to LF
      .replace(/\n{3,}/g, '\n\n'); // Collapse excessive newlines

    return result;
  };

  const { command, args } = buildCcrExecCommand({ workingDir, prompt, model });

  logger.debug(`CCR runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}`);
  logger.debug(`CCR runner - args count: ${args.length}, model: ${model ?? 'default'}`);

  // Create telemetry capture instance
  const telemetryCapture = createTelemetryCapture('claude', model, prompt, workingDir); // Using 'claude' for telemetry since API is the same

  // Track JSON error events (CCR may exit 0 even on errors)
  let capturedError: string | null = null;

  let result;
  try {
    result = await spawnProcess({
      command,
      args,
      cwd: workingDir,
      env: mergedEnv,
      stdinInput: prompt, // Pass prompt via stdin instead of command-line argument
      onStdout: inheritTTY
        ? undefined
        : (chunk) => {
            const out = normalize(chunk);

            // Format and display each JSON line
            const lines = out.trim().split('\n');
            for (const line of lines) {
              if (!line.trim()) continue;

              // Capture telemetry data
              telemetryCapture.captureFromStreamJson(line);

              // Check for error events (CCR may exit 0 even on errors like invalid model)
              try {
                const json = JSON.parse(line);
                // Check for error in result type
                if (json.type === 'result' && json.is_error && json.result && !capturedError) {
                  capturedError = json.result;
                }
                // Check for error in assistant message
                if (json.type === 'assistant' && json.error && !capturedError) {
                  const messageText = json.message?.content?.[0]?.text;
                  capturedError = messageText || json.error;
                }
              } catch {
                // Ignore parse errors
              }

              const formatted = formatStreamJsonLine(line);
              if (formatted) {
                onData?.(formatted + '\n');
              }
            }
          },
      onStderr: inheritTTY
        ? undefined
        : (chunk) => {
            const out = normalize(chunk);
            onErrorData?.(out);
          },
      signal: abortSignal,
      stdioMode: inheritTTY ? 'inherit' : 'pipe',
      timeout,
    });
  } catch (error) {
    const err = error as unknown as { code?: string; message?: string };
    const message = err?.message ?? '';
    const notFound = err?.code === 'ENOENT' || /not recognized as an internal or external command/i.test(message) || /command not found/i.test(message);
    if (notFound) {
      const full = `${command} ${args.join(' ')}`.trim();
      const install = metadata.installCommand;
      const name = metadata.name;
      logger.error(`${name} CLI not found when executing: ${full}`);
      throw new Error(`'${command}' is not available on this system. Please install ${name} first:\n  ${install}`);
    }
    throw error;
  }

  if (result.exitCode !== 0 || capturedError) {
    const errorOutput = result.stderr.trim() || result.stdout.trim() || 'no error output';
    const lines = errorOutput.split('\n').slice(0, 10);

    logger.error('CCR CLI execution failed', {
      exitCode: result.exitCode,
      error: lines.join('\n'),
      command: `${command} ${args.join(' ')}`,
    });

    // Use captured JSON error if available, otherwise fall back to generic message
    const errorMessage = capturedError || `CCR CLI exited with code ${result.exitCode}`;
    throw new Error(errorMessage);
  }

  // Log captured telemetry
  telemetryCapture.logCapturedTelemetry(result.exitCode);

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}