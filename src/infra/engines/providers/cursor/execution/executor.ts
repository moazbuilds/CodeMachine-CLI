import { runCursor } from './runner.js';
import { renderToChalk } from '../../../../../shared/formatters/outputMarkers.js';

export interface RunAgentOptions {
  abortSignal?: AbortSignal;
  logger?: (chunk: string) => void;
  stderrLogger?: (chunk: string) => void;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
  model?: string; // Model to use (e.g., 'auto', 'gpt-5', 'sonnet-4.5')
}

export function shouldSkipCursor(): boolean {
  return process.env.CODEMACHINE_SKIP_CURSOR === '1';
}

export async function runCursorPrompt(options: {
  agentId: string;
  prompt: string;
  cwd: string;
  model?: string;
}): Promise<void> {
  if (shouldSkipCursor()) {
    console.log(`[dry-run] ${options.agentId}: ${options.prompt.slice(0, 80)}...`);
    return;
  }

  await runCursor({
    prompt: options.prompt,
    workingDir: options.cwd,
    model: options.model,
    onData: (chunk) => {
      try {
        process.stdout.write(renderToChalk(chunk));
      } catch {
        // Ignore stdout write errors
      }
    },
    onErrorData: (chunk) => {
      try {
        process.stderr.write(chunk);
      } catch {
        // Ignore stderr write errors
      }
    },
  });
}

export async function runAgent(
  agentId: string,
  prompt: string,
  cwd: string,
  options: RunAgentOptions = {},
): Promise<string> {
  const logStdout: (chunk: string) => void = options.logger
    ?? ((chunk: string) => {
      try {
        process.stdout.write(renderToChalk(chunk));
      } catch {
        // Ignore stdout write errors
      }
    });
  const logStderr: (chunk: string) => void = options.stderrLogger
    ?? ((chunk: string) => {
      try {
        process.stderr.write(chunk);
      } catch {
        // Ignore stderr write errors
      }
    });

  if (shouldSkipCursor()) {
    logStdout(`[dry-run] ${agentId}: ${prompt.slice(0, 120)}...`);
    return '';
  }

  let buffered = '';
  const result = await runCursor({
    prompt,
    workingDir: cwd,
    model: options.model,
    abortSignal: options.abortSignal,
    timeout: options.timeout,
    onData: (chunk) => {
      buffered += chunk;
      logStdout(chunk);
    },
    onErrorData: (chunk) => {
      logStderr(chunk);
    },
  });

  const stdout = buffered || result.stdout || '';
  return stdout;
}
