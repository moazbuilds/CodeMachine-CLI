import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildClaudeExecCommand } from './commands.js';
import { metadata } from '../metadata.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { createTelemetryCapture } from '../../../../../shared/telemetry/index.js';
import type { ParsedTelemetry } from '../../../core/types.js';
import {
  formatThinking,
  formatCommand,
  formatResult,
  formatStatus,
  formatDuration,
  formatCost,
  formatTokens,
  addMarker,
  SYMBOL_BULLET,
} from '../../../../../shared/formatters/outputMarkers.js';

export interface RunClaudeOptions {
  prompt: string;
  workingDir: string;
  model?: string;
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  onTelemetry?: (telemetry: ParsedTelemetry) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
}

export interface RunClaudeResult {
  stdout: string;
  stderr: string;
}

const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');

// Track tool names for associating with results
const toolNameMap = new Map<string, string>();

/**
 * Formats a Claude stream-json line for display
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
    } else if (json.type === 'system' && json.subtype === 'init') {
      // Show status message when session starts
      return formatStatus('Claude is analyzing your request...');
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

      // Format telemetry line with rich formatting
      const durationStr = formatDuration(json.duration_ms);
      const costStr = formatCost(json.total_cost_usd);
      const tokensStr = formatTokens(totalIn, json.usage.output_tokens, totalCached > 0 ? totalCached : undefined);
      return addMarker('GRAY', `${SYMBOL_BULLET} `, 'DIM') + `${durationStr} ${addMarker('GRAY', '│', 'DIM')} ${costStr} ${addMarker('GRAY', '│', 'DIM')} ${tokensStr}`;
    }

    return null;
  } catch {
    return null;
  }
}

export async function runClaude(options: RunClaudeOptions): Promise<RunClaudeResult> {
  const { prompt, workingDir, model, env, onData, onErrorData, onTelemetry, abortSignal, timeout = 1800000 } = options;

  if (!prompt) {
    throw new Error('runClaude requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runClaude requires a working directory.');
  }

  // Set up CLAUDE_CONFIG_DIR for authentication
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    ? expandHomeDir(process.env.CLAUDE_CONFIG_DIR)
    : path.join(homedir(), '.codemachine', 'claude');

  const mergedEnv = {
    ...process.env,
    ...(env ?? {}),
    CLAUDE_CONFIG_DIR: claudeConfigDir,
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

  const { command, args } = buildClaudeExecCommand({ workingDir, prompt, model });

  // Debug logging when LOG_LEVEL=debug
  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] Claude runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}`);
    console.error(`[DEBUG] Claude runner - args: ${args.join(' ')}, model: ${model ?? 'default'}`);
    console.error(`[DEBUG] Claude runner - command: ${command} ${args.join(' ')}`);
    console.error(`[DEBUG] Claude runner - working dir: ${workingDir}`);
    console.error(`[DEBUG] Claude runner - prompt preview: ${prompt.substring(0, 200)}...`);
  }

  // Create telemetry capture instance
  const telemetryCapture = createTelemetryCapture('claude', model, prompt, workingDir);

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

            // Emit telemetry event if captured and callback provided
            if (onTelemetry) {
              const captured = telemetryCapture.getCaptured();
              if (captured && captured.tokens) {
                // tokensIn should be TOTAL input tokens (non-cached + cached)
                // to match the log output format
                const totalIn = (captured.tokens.input ?? 0) + (captured.tokens.cached ?? 0);
                onTelemetry({
                  tokensIn: totalIn,
                  tokensOut: captured.tokens.output ?? 0,
                  cached: captured.tokens.cached,
                  cost: captured.cost,
                  duration: captured.duration,
                });
              }
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
      console.error(`[ERROR] ${name} CLI not found when executing: ${full}`);
      throw new Error(`'${command}' is not available on this system. Please install ${name} first:\n  ${install}`);
    }
    throw error;
  }

  if (result.exitCode !== 0) {
    const errorOutput = result.stderr.trim() || result.stdout.trim() || 'no error output';

    // Parse the error to provide a user-friendly message
    let errorMessage = `Claude CLI exited with code ${result.exitCode}`;
    try {
      // Try to parse stream-json output for specific error messages
      const lines = errorOutput.split('\n');
      for (const line of lines) {
        if (line.trim() && line.startsWith('{')) {
          const json = JSON.parse(line);

          // Check for error in result type
          if (json.type === 'result' && json.is_error && json.result) {
            errorMessage = json.result;
            break;
          }

          // Check for error in assistant message
          if (json.type === 'assistant' && json.error) {
            const messageText = json.message?.content?.[0]?.text;
            if (messageText) {
              errorMessage = messageText;
            } else if (json.error === 'rate_limit') {
              errorMessage = 'Rate limit reached. Please try again later.';
            } else {
              errorMessage = json.error;
            }
            break;
          }
        }
      }
    } catch {
      // If parsing fails, use the raw error output
      const lines = errorOutput.split('\n').slice(0, 10);
      if (lines.length > 0 && lines[0]) {
        errorMessage = lines.join('\n');
      }
    }

    // Send error to stderr callback if provided
    if (onErrorData) {
      onErrorData(`\n[ERROR] ${errorMessage}\n`);
    }

    throw new Error(errorMessage);
  }

  // Log captured telemetry
  telemetryCapture.logCapturedTelemetry(result.exitCode);

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
