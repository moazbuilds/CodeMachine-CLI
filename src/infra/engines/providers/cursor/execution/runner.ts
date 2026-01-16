import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildCursorExecCommand } from './commands.js';
import { metadata } from '../metadata.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { ENV } from '../config.js';
import { formatThinking, formatCommand, formatResult, formatStatus } from '../../../../../shared/formatters/outputMarkers.js';
import { debug } from '../../../../../shared/logging/logger.js';

export interface RunCursorOptions {
  prompt: string;
  workingDir: string;
  resumeSessionId?: string;
  resumePrompt?: string;
  model?: string;
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  onSessionId?: (sessionId: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
}

export interface RunCursorResult {
  stdout: string;
  stderr: string;
}

// Track tool names for associating with results
const toolNameMap = new Map<string, string>();

// Track accumulated thinking text for delta updates
let accumulatedThinking = '';

/**
 * Formats a Cursor stream-json line for display
 */
function formatStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    // Handle system lifecycle events
    if (json.type === 'system' && json.subtype === 'init') {
      // Skip system init messages
      return null;
    }

    // Handle user messages (request started)
    if (json.type === 'user' && json.message) {
      return formatStatus('Cursor is analyzing your request...');
    }

    // Handle root-level thinking messages (Grok and other models)
    if (json.type === 'thinking') {
      if (json.subtype === 'delta' && json.text) {
        // Accumulate thinking deltas
        accumulatedThinking += json.text;
        // Return null for deltas to avoid spamming output with each token
        return null;
      } else if (json.subtype === 'completed') {
        // When thinking is complete, return the full thinking block
        if (accumulatedThinking) {
          const result = formatThinking(accumulatedThinking);
          accumulatedThinking = ''; // Reset for next thinking block
          return result;
        }
        return null;
      }
    }

    // Handle root-level tool_call messages (Cursor format)
    // Structure: { type: "tool_call", subtype: "started"|"completed", tool_call: { lsToolCall: {...} } }
    if (json.type === 'tool_call') {
      // Extract tool name from tool_call object key (e.g., "lsToolCall" -> "ls")
      const toolCallObj = json.tool_call;
      const toolKey = Object.keys(toolCallObj || {}).find((k: string) => k.endsWith('ToolCall'));
      const toolName = toolKey ? toolKey.replace('ToolCall', '') : 'tool';

      if (json.subtype === 'started') {
        // Show tool starting
        return formatCommand(toolName, 'started');
      } else if (json.subtype === 'completed') {
        // Show tool completed with result (like OpenCode's tool_use)
        const toolData = toolCallObj?.[toolKey!];
        const result = toolData?.result;

        if (result?.error) {
          const errorMsg = typeof result.error === 'string'
            ? result.error
            : (result.error?.message || JSON.stringify(result.error));
          return formatCommand(toolName, 'error') + '\n' + formatResult(errorMsg, true);
        } else if (result?.success !== undefined) {
          // Get a preview of the success result
          let preview: string;
          const success = result.success;
          if (typeof success === 'string') {
            const trimmed = success.trim();
            preview = trimmed.length > 150 ? trimmed.substring(0, 150) + '...' : trimmed;
          } else if (success === null || success === undefined) {
            preview = 'done';
          } else {
            // For objects, try to extract meaningful preview
            const successStr = JSON.stringify(success);
            preview = successStr.length > 150 ? successStr.substring(0, 150) + '...' : successStr;
          }
          return formatCommand(toolName, 'success') + '\n' + formatResult(preview || 'done', false);
        }
        // Fallback for unknown result format
        return formatCommand(toolName, 'success');
      }
    }

    // Handle assistant messages
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
      return `⏱️  Duration: ${json.duration_ms}ms | Cost: $${json.total_cost_usd} | Tokens: ${json.usage.input_tokens}in/${json.usage.output_tokens}out`;
    }

    return null;
  } catch {
    return null;
  }
}

export async function runCursor(options: RunCursorOptions): Promise<RunCursorResult> {
  const { prompt, workingDir, resumeSessionId, resumePrompt, model, env, onData, onErrorData, onSessionId, abortSignal, timeout = 1800000 } = options;

  if (!prompt) {
    throw new Error('runCursor requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runCursor requires a working directory.');
  }

  // Set up CURSOR_CONFIG_DIR for authentication
  const cursorConfigDir = process.env[ENV.CURSOR_HOME]
    ? expandHomeDir(process.env[ENV.CURSOR_HOME]!)
    : path.join(homedir(), '.codemachine', 'cursor');

  const mergedEnv = {
    ...process.env,
    ...(env ?? {}),
    CURSOR_CONFIG_DIR: cursorConfigDir,
  };

  // Force pipe mode to ensure text normalization is applied
  const inheritTTY = false;

  const normalize = (text: string): string => {
    // Simple but effective approach to fix carriage return wrapping issues
    let result = text;

    // Handle carriage returns that cause line overwrites
    // When we see \r followed by text, it means the text should overwrite what came before
    // So we keep only the text after the last \r in each line
    result = result.replace(/^.*\r([^\r\n]*)/gm, '$1');

    // Clean up line endings
    result = result
      .replace(/\r\n/g, '\n')  // Convert CRLF to LF
      .replace(/\r/g, '\n')    // Convert remaining CR to LF
      .replace(/\n{3,}/g, '\n\n'); // Collapse excessive newlines

    return result;
  };

  const { command, args } = buildCursorExecCommand({
    workingDir,
    resumeSessionId,
    model,
    cursorConfigDir
  });

  // Debug logging
  debug(`Cursor runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}`);
  debug(`Cursor runner - args count: ${args.length}, model: ${model ?? 'auto'}`);

  let sessionIdCaptured = false;

  let result;
  try {
    result = await spawnProcess({
      command,
      args,
      cwd: workingDir,
      env: mergedEnv,
      stdinInput: resumeSessionId ? resumePrompt : prompt,
    onStdout: inheritTTY
      ? undefined
      : (chunk) => {
          const out = normalize(chunk);

          // Format and display each JSON line
          const lines = out.trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;

            // Capture session ID from first event that contains it
            try {
              const json = JSON.parse(line);
              if (!sessionIdCaptured && json.session_id && onSessionId) {
                sessionIdCaptured = true;
                onSessionId(json.session_id);
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

          // Check for common Cursor errors and provide helpful messages
          if (out.includes('ConnectError: [invalid_argument]') || out.includes('Error =')) {
            onErrorData?.('⚠️  Cursor Error: This is commonly related to plan mode. You may need to check if you\'re in plan mode to use pro models.\n');
          }

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

  if (result.exitCode !== 0) {
    const errorOutput = result.stderr.trim() || result.stdout.trim() || 'no error output';
    const lines = errorOutput.split('\n').slice(0, 10);
    const preview = lines.join('\n');
    throw new Error(preview);
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
