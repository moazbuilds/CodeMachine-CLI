import * as path from 'node:path';
import * as fs from 'node:fs';
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

export interface RunMistralResult {
  stdout: string;
  stderr: string;
}

const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');

/**
 * Find the most recent session file created after startTime
 * Session files are stored in VIBE_HOME/logs/session/ with format:
 *   session_{date}_{time}_{short_id}.json
 * The full session_id is in the metadata.session_id field inside the file.
 */
function findLatestSessionId(vibeHome: string, startTime: number): string | null {
  const sessionDir = path.join(vibeHome, 'logs', 'session');

  try {
    if (!fs.existsSync(sessionDir)) {
      return null;
    }

    const files = fs.readdirSync(sessionDir)
      .filter(f => f.startsWith('session_') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(sessionDir, f),
        mtime: fs.statSync(path.join(sessionDir, f)).mtimeMs,
      }))
      .filter(f => f.mtime >= startTime)
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      return null;
    }

    // Read the most recent session file and extract session_id from metadata
    const content = fs.readFileSync(files[0].path, 'utf-8');
    const json = JSON.parse(content);
    return json.metadata?.session_id || null;
  } catch {
    return null;
  }
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

// Track tool names for associating with results
const toolNameMap = new Map<string, string>();

/**
 * Formats a Mistral stream-json line for display
 */
function formatStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    const role = json.role || json.type;
    const content = json.content || json.message?.content;

    if (role === 'assistant') {
      // Handle tool_calls array
      if (Array.isArray(json.tool_calls) && json.tool_calls.length > 0) {
        const results: string[] = [];
        for (const toolCall of json.tool_calls) {
          const toolName = toolCall.function?.name || toolCall.name || 'tool';
          const toolId = toolCall.id;
          if (toolId && toolName) {
            toolNameMap.set(toolId, toolName);
          }
          results.push(formatCommand(toolName, 'started'));
        }
        return results.join('\n');
      }

      // Handle text content
      if (typeof content === 'string' && content.trim()) {
        return content;
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            return block.text;
          } else if (block.type === 'thinking' && block.text) {
            return formatThinking(block.text);
          } else if (block.type === 'tool_use') {
            if (block.id && block.name) {
              toolNameMap.set(block.id, block.name);
            }
            return formatCommand(block.name || 'tool', 'started');
          }
        }
      }
    } else if (role === 'tool') {
      // Handle tool results
      const toolName = json.name || (json.tool_call_id ? toolNameMap.get(json.tool_call_id) : undefined) || 'tool';

      if (json.tool_call_id) {
        toolNameMap.delete(json.tool_call_id);
      }

      let preview: string;
      const toolContent = json.content;
      if (typeof toolContent === 'string') {
        const trimmed = toolContent.trim();
        preview = trimmed
          ? (trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed)
          : 'empty';
      } else {
        preview = JSON.stringify(toolContent);
      }
      return formatCommand(toolName, 'success') + '\n' + formatResult(preview, false);
    } else if (role === 'user') {
      // Handle user messages with tool results
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_result') {
            const toolName = block.tool_use_id ? toolNameMap.get(block.tool_use_id) : undefined;
            const commandName = toolName || 'tool';

            if (block.tool_use_id) {
              toolNameMap.delete(block.tool_use_id);
            }

            let preview: string;
            if (block.is_error) {
              preview = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
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
  const { prompt, workingDir, resumeSessionId, resumePrompt, model, env, onData, onErrorData, onTelemetry, onSessionId, abortSignal, timeout = 1800000 } = options;

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

  // When resuming, use the resume prompt instead of the original prompt
  const effectivePrompt = resumeSessionId ? buildResumePrompt(resumePrompt) : prompt;
  const { command, args } = buildMistralExecCommand({ workingDir, prompt: effectivePrompt, resumeSessionId, model });

  // Create telemetry capture instance
  const telemetryCapture = createTelemetryCapture('mistral', model, prompt, workingDir);

  // Track JSON error events (Mistral may exit 0 even on errors)
  let capturedError: string | null = null;
  let sessionIdCaptured = false;

  // Record start time to find session files created during this run
  const startTime = Date.now();

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

              // Capture session ID from first event that contains it
              if (!sessionIdCaptured && json.session_id && onSessionId) {
                sessionIdCaptured = true;
                onSessionId(json.session_id);
              }

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
    const err = error as unknown as { code?: string; message?: string; name?: string };
    const message = err?.message ?? '';
    const notFound = err?.code === 'ENOENT' || /not recognized as an internal or external command/i.test(message) || /command not found/i.test(message);
    if (notFound) {
      const install = metadata.installCommand;
      const name = metadata.name;
      throw new Error(`'${command}' is not available on this system. Please install ${name} first:\n  ${install}`);
    }

    // Try to capture session ID even on abort - vibe saves session on exit
    // This is important for pause/resume functionality
    if (err?.name === 'AbortError' && !sessionIdCaptured && onSessionId) {
      const sessionId = findLatestSessionId(vibeHome, startTime);
      if (sessionId) {
        sessionIdCaptured = true;
        onSessionId(sessionId);
      }
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

  // If session ID wasn't captured from streaming output, try to find it from session files
  // Vibe doesn't include session_id in streaming JSON output, but saves it to session files
  if (!sessionIdCaptured && onSessionId) {
    const sessionId = findLatestSessionId(vibeHome, startTime);
    if (sessionId) {
      sessionIdCaptured = true;
      onSessionId(sessionId);
    }
  }

  // Log captured telemetry
  telemetryCapture.logCapturedTelemetry(result.exitCode);

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

