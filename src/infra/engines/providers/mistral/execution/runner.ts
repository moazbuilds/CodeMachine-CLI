import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildMistralExecCommand } from './commands.js';
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

export interface RunMistralOptions {
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

export interface RunMistralResult {
  stdout: string;
  stderr: string;
}

const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');

// Track tool names for associating with results
const toolNameMap = new Map<string, string>();

/**
 * Formats a Mistral stream-json line for display
 */
function formatStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    // Mistral Vibe uses role/content format instead of type/message format
    // Handle both formats for compatibility
    const role = json.role || json.type;
    const content = json.content || json.message?.content;

    if (role === 'assistant') {
      // Handle assistant messages
      if (typeof content === 'string') {
        // Simple string content
        return content;
      } else if (Array.isArray(content)) {
        // Array of content blocks (like Claude/Gemini format)
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            return block.text;
          } else if (block.type === 'thinking' && block.text) {
            return formatThinking(block.text);
          } else if (block.type === 'tool_use') {
            // Track tool name for later use with result
            if (block.id && block.name) {
              toolNameMap.set(block.id, block.name);
            }
            const commandName = block.name || 'tool';
            return formatCommand(commandName, 'started');
          }
        }
      }
    } else if (role === 'user') {
      // Handle user messages (tool results)
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_result') {
            // Get tool name from map
            const toolName = block.tool_use_id ? toolNameMap.get(block.tool_use_id) : undefined;
            const commandName = toolName || 'tool';

            // Clean up the map entry
            if (block.tool_use_id) {
              toolNameMap.delete(block.tool_use_id);
            }

            let preview: string;
            if (block.is_error) {
              preview = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
              // Show command in red with nested error
              return formatCommand(commandName, 'error') + '\n' + formatResult(preview, true);
            } else {
              if (typeof block.content === 'string') {
                const trimmed = block.content.trim();
                preview = trimmed
                  ? (trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed)
                  : 'empty';
              } else {
                preview = JSON.stringify(block.content);
              }
              // Show command in green with nested result
              return formatCommand(commandName, 'success') + '\n' + formatResult(preview, false);
            }
          }
        }
      }
    } else if (role === 'system' || (json.type === 'system' && json.subtype === 'init')) {
      // Show status message when session starts
      return formatStatus('Mistral is analyzing your request...');
    } else if (json.type === 'result' || json.usage) {
      // Handle telemetry/result messages
      // Calculate total input tokens (non-cached + cached)
      const cacheRead = json.usage?.cache_read_input_tokens || 0;
      const cacheCreation = json.usage?.cache_creation_input_tokens || 0;
      const totalCached = cacheRead + cacheCreation;
      const totalIn = (json.usage?.input_tokens || 0) + totalCached;

      // Show total input tokens with optional cached indicator
      const tokensDisplay = totalCached > 0
        ? `${totalIn}in/${json.usage?.output_tokens || 0}out (${totalCached} cached)`
        : `${totalIn}in/${json.usage?.output_tokens || 0}out`;

      // Format telemetry line with rich formatting
      const durationStr = formatDuration(json.duration_ms);
      const costStr = formatCost(json.total_cost_usd);
      const tokensStr = formatTokens(totalIn, json.usage?.output_tokens || 0, totalCached > 0 ? totalCached : undefined);
      return addMarker('GRAY', `${SYMBOL_BULLET} `, 'DIM') + `${durationStr} ${addMarker('GRAY', '│', 'DIM')} ${costStr} ${addMarker('GRAY', '│', 'DIM')} ${tokensStr}`;
    }

    return null;
  } catch {
    return null;
  }
}

export async function runMistral(options: RunMistralOptions): Promise<RunMistralResult> {
  const { prompt, workingDir, model, env, onData, onErrorData, onTelemetry, abortSignal, timeout = 1800000 } = options;

  if (!prompt) {
    throw new Error('runMistral requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runMistral requires a working directory.');
  }

  // Set up VIBE_HOME / MISTRAL_CONFIG_DIR for authentication (prefer VIBE_HOME)
  const vibeHome = process.env.VIBE_HOME
    ? expandHomeDir(process.env.VIBE_HOME)
    : process.env.MISTRAL_CONFIG_DIR
      ? expandHomeDir(process.env.MISTRAL_CONFIG_DIR)
      : path.join(homedir(), '.codemachine', 'vibe');

  const mergedEnv = {
    ...process.env,
    ...(env ?? {}),
    VIBE_HOME: vibeHome,
    MISTRAL_CONFIG_DIR: vibeHome,
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

  const { command, args } = buildMistralExecCommand({ workingDir, prompt, model });

  // Create telemetry capture instance
  const telemetryCapture = createTelemetryCapture('mistral', model, prompt, workingDir);

  // Track JSON error events (Mistral may exit 0 even on errors)
  let capturedError: string | null = null;

  let result;
  try {
    result = await spawnProcess({
      command,
      args,
      cwd: workingDir,
      env: mergedEnv,
      // Note: Prompt is already included in args (as argument to -p flag)
      // Do not pass stdinInput for Mistral Vibe
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

            // Check for error events (Mistral may exit 0 even on errors like invalid model)
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
      const install = metadata.installCommand;
      const name = metadata.name;
      throw new Error(`'${command}' is not available on this system. Please install ${name} first:\n  ${install}`);
    }
    throw error;
  }

  // Check for errors - Mistral may exit with code 0 even on errors (e.g., invalid model)
  if (result.exitCode !== 0 || capturedError) {
    // Use captured error from streaming, or fall back to parsing output
    let errorMessage = capturedError || `Mistral CLI exited with code ${result.exitCode}`;

    if (!capturedError) {
      const errorOutput = result.stderr.trim() || result.stdout.trim() || 'no error output';
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

