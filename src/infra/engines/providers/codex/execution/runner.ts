import * as path from 'node:path';
import { homedir } from 'node:os';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildCodexCommand } from './commands.js';
import { metadata } from '../metadata.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { ENV } from '../config.js';
import type { ParsedTelemetry } from '../../../core/types.js';
import { formatThinking, formatCommand, formatResult, formatMessage, formatStatus, formatMcpCall, formatMcpResult } from '../../../../../shared/formatters/outputMarkers.js';
import { debug } from '../../../../../shared/logging/logger.js';

/**
 * Get Codex session file path
 * Session files are stored at: $CODEX_HOME/sessions/YYYY/MM/DD/rollout-...-<session_id>.jsonl
 */
function getSessionPath(sessionId: string, codexHome: string): string | null {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  const sessionsDir = path.join(codexHome, 'sessions', year, month, day);

  if (!existsSync(sessionsDir)) {
    debug('[SESSION-READER] Sessions directory not found: %s', sessionsDir);
    return null;
  }

  // Find the session file matching this session ID
  try {
    const files = readdirSync(sessionsDir);
    const sessionFile = files.find(f => f.includes(sessionId) && f.endsWith('.jsonl'));
    if (sessionFile) {
      return path.join(sessionsDir, sessionFile);
    }
  } catch (err) {
    debug('[SESSION-READER] Error reading sessions directory: %s', err);
  }

  return null;
}

/**
 * Read telemetry from Codex session file (last token_count event with total_token_usage)
 */
function readSessionTelemetry(sessionPath: string): ParsedTelemetry | null {
  if (!existsSync(sessionPath)) {
    debug('[SESSION-READER] File not found: %s', sessionPath);
    return null;
  }

  try {
    const content = readFileSync(sessionPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Read from end to find most recent token_count event
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (
          entry.type === 'event_msg' &&
          entry.payload?.type === 'token_count' &&
          entry.payload?.info?.total_token_usage
        ) {
          const usage = entry.payload.info.total_token_usage;

          debug('[SESSION-READER] total_token_usage: input=%d, output=%d, cached=%d',
            usage.input_tokens, usage.output_tokens, usage.cached_input_tokens);

          // Pass through raw values from total_token_usage
          return {
            tokensIn: usage.input_tokens || 0,
            tokensOut: usage.output_tokens || 0,
            cached: usage.cached_input_tokens || 0,
          };
        }
      } catch { /* skip malformed */ }
    }
    return null;
  } catch (err) {
    debug('[SESSION-READER] Error: %s', err);
    return null;
  }
}

export interface RunCodexOptions {
  prompt: string;
  workingDir: string;
  resumeSessionId?: string;
  resumePrompt?: string;
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  onTelemetry?: (telemetry: ParsedTelemetry) => void;
  onSessionId?: (sessionId: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
}

export interface RunCodexResult {
  stdout: string;
  stderr: string;
}

/**
 * Formats a Codex stream-json line for display
 */
function formatCodexStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    // Handle reasoning items (thinking)
    if (json.type === 'item.completed' && json.item?.type === 'reasoning') {
      return formatThinking(json.item.text) + '\n';
    }

    // Handle command execution
    if (json.type === 'item.started' && json.item?.type === 'command_execution') {
      const command = json.item.command ?? 'command';
      return formatCommand(command, 'started');
    }

    if (json.type === 'item.completed' && json.item?.type === 'command_execution') {
      const exitCode = json.item.exit_code ?? 0;
      const command = json.item.command;

      if (exitCode === 0) {
        const output = json.item.aggregated_output?.trim() || '';
        const preview = output
          ? (output.length > 100 ? output.substring(0, 100) + '...' : output)
          : 'empty';
        // Show command in green with nested result
        return formatCommand(command, 'success') + '\n' + formatResult(preview, false);
      } else {
        // Show command in red with nested error
        return formatCommand(command, 'error') + '\n' + formatResult(`Exit code ${exitCode}`, true);
      }
    }

    // Handle agent messages
    if (json.type === 'item.completed' && json.item?.type === 'agent_message') {
      return formatMessage(json.item.text);
    }

    // Handle MCP tool calls (signals) - only show completed
    if (json.type === 'item.completed' && json.item?.type === 'mcp_tool_call') {
      const server = json.item.server ?? 'mcp';
      const tool = json.item.tool ?? 'unknown';
      const status = json.item.status;
      const isError = status === 'failed' || status === 'error';

      // Format the call completion
      let output = formatMcpCall(server, tool, isError ? 'error' : 'completed');

      // Add result preview if available
      if (json.item.result?.content) {
        const content = json.item.result.content;
        // Extract text from content array if present
        const textContent = Array.isArray(content)
          ? content.map((c: { text?: string }) => c.text ?? '').join('\n')
          : String(content);
        if (textContent) {
          const preview = textContent.length > 150
            ? textContent.substring(0, 150) + '...'
            : textContent;
          output += '\n' + formatMcpResult(preview, isError);
        }
      }

      return output;
    }

    // Handle turn/thread lifecycle events
    if (json.type === 'thread.started' || json.type === 'turn.started' || json.type === 'turn.completed') {
      // Show status message when turn starts
      if (json.type === 'turn.started') {
        return formatStatus('Codex is analyzing your request...');
      }

      // Show usage info at turn completion
      if (json.type === 'turn.completed' && json.usage) {
        const { input_tokens, cached_input_tokens, output_tokens } = json.usage;
        const totalIn = input_tokens + (cached_input_tokens || 0);
        return `⏱️  Tokens: ${totalIn}in/${output_tokens}out${cached_input_tokens ? ` (${cached_input_tokens} cached)` : ''}`;
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function runCodex(options: RunCodexOptions): Promise<RunCodexResult> {
  const { prompt, workingDir, resumeSessionId, resumePrompt, model, modelReasoningEffort, env, onData, onErrorData, onTelemetry, onSessionId, abortSignal, timeout = 1800000 } = options;

  // DEBUG: Log resume parameters
  debug(`[DEBUG codex runner.ts] runCodex called with resumeSessionId=${resumeSessionId}, resumePrompt="${resumePrompt}"`);

  if (!prompt) {
    throw new Error('runCodex requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runCodex requires a working directory.');
  }

  // Prefer calling the real Codex CLI directly, mirroring runner-prompts spec
  // Example (Linux/Mac):
  //   CODEX_HOME="$HOME/.codemachine/codex" codex exec \
  //     --skip-git-repo-check \
  //     --sandbox danger-full-access --dangerously-bypass-approvals-and-sandbox \
  //     -C <workingDir> "<composite prompt>"

  // Expand platform-specific home directory variables in CODEX_HOME
  const codexHome = process.env[ENV.CODEX_HOME]
    ? expandHomeDir(process.env[ENV.CODEX_HOME]!)
    : path.join(homedir(), '.codemachine', 'codex');
  const mergedEnv = { ...process.env, ...(env ?? {}), CODEX_HOME: codexHome };

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

  const { command, args } = buildCodexCommand({ workingDir, resumeSessionId, resumePrompt, model, modelReasoningEffort });

  // Debug logging
  debug(`Codex runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}`);
  debug(`Codex runner - args count: ${args.length}`);
  debug(
    `Codex runner - CLI: ${command} ${args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')} | stdin preview: ${prompt.slice(0, 120)}`
  );

  // Track JSON error events (Codex may exit 0 even on errors)
  let capturedError: string | null = null;
  let capturedSessionId: string | null = null;
  let stdoutBuffer = '';

  // Accumulate output tokens across turns
  let accumulatedTokensOut = 0;

  const handleStreamLine = (line: string): void => {
    if (!line.trim()) return;

    // Capture session_id from thread.started event and check for errors
    try {
      const json = JSON.parse(line);
      if (json.type === 'thread.started' && json.thread_id) {
        capturedSessionId = json.thread_id;
        debug(`[SESSION_ID CAPTURED] ${json.thread_id}`);
        if (onSessionId) {
          onSessionId(json.thread_id);
        }
      }
      // Capture error events (Codex exits 0 even on errors like invalid model)
      if (json.type === 'error' && json.message && !capturedError) {
        capturedError = json.message;
      }
      if (json.type === 'turn.failed' && json.error?.message && !capturedError) {
        capturedError = json.error.message;
      }

      // Read telemetry from session file when turn completes
      if (json.type === 'turn.completed' && onTelemetry && capturedSessionId) {
        const sessionPath = getSessionPath(capturedSessionId, codexHome);
        if (sessionPath) {
          debug('[SESSION-READER] Reading telemetry from: %s', sessionPath);
          const telemetry = readSessionTelemetry(sessionPath);
          if (telemetry) {
            // Accumulate output tokens across turns
            accumulatedTokensOut += telemetry.tokensOut;
            debug('[SESSION-READER] Accumulated tokensOut: %d (this turn: %d)',
              accumulatedTokensOut, telemetry.tokensOut);

            onTelemetry({
              tokensIn: telemetry.tokensIn,
              tokensOut: accumulatedTokensOut,
              cached: telemetry.cached,
            });
          }
        }
      }
    } catch {
      // Ignore parse errors
    }

    const formatted = formatCodexStreamJsonLine(line);
    if (formatted) {
      onData?.(formatted + '\n');
    }
  };

  let result;
  try {
    result = await spawnProcess({
      command,
      args,
      cwd: workingDir,
      env: mergedEnv,
      stdinInput: resumeSessionId ? undefined : prompt, // Skip stdin for resume
    onStdout: inheritTTY
      ? undefined
      : (chunk) => {
          stdoutBuffer += normalize(chunk);

          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() ?? '';
          for (const line of lines) {
            handleStreamLine(line);
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

  if (stdoutBuffer.trim()) {
    handleStreamLine(stdoutBuffer);
    stdoutBuffer = '';
  }

  // Check for errors - Codex may exit with code 0 even on errors (e.g., invalid model)
  if (result.exitCode !== 0 || capturedError) {
    const errorOutput = capturedError || result.stderr.trim() || result.stdout.trim() || 'no error output';
    const lines = errorOutput.split('\n').slice(0, 10);
    const preview = lines.join('\n');
    throw new Error(preview);
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
