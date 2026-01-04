import { runCodex } from './runner.js';
import { renderToChalk } from '../../../../../shared/formatters/outputMarkers.js';

export interface RunAgentOptions {
  abortSignal?: AbortSignal;
  logger?: (chunk: string) => void;
  stderrLogger?: (chunk: string) => void;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
}

export function shouldSkipCodex(): boolean {
  return process.env.CODEMACHINE_SKIP_CODEX === '1';
}

export async function runCodexPrompt(options: {
  agentId: string;
  prompt: string;
  cwd: string;
}): Promise<void> {
  if (shouldSkipCodex()) {
    console.log(`[dry-run] ${options.agentId}: ${options.prompt.slice(0, 80)}...`);
    return;
  }

  await runCodex({
    prompt: options.prompt,
    workingDir: options.cwd,
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

  if (shouldSkipCodex()) {
    logStdout(`[dry-run] ${agentId}: ${prompt.slice(0, 120)}...`);
    return '';
  }

  let buffered = '';
  const result = await runCodex({
    prompt,
    workingDir: cwd,
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
