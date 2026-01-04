import { runClaude } from './runner.js';

export interface RunAgentOptions {
  abortSignal?: AbortSignal;
  logger?: (chunk: string) => void;
  stderrLogger?: (chunk: string) => void;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
  model?: string; // Model to use (e.g., 'sonnet', 'opus', 'haiku')
}

export function shouldSkipClaude(): boolean {
  return process.env.CODEMACHINE_SKIP_CLAUDE === '1';
}

export async function runClaudePrompt(options: {
  agentId: string;
  prompt: string;
  cwd: string;
  model?: string;
}): Promise<void> {
  if (shouldSkipClaude()) {
    console.log(`[dry-run] ${options.agentId}: ${options.prompt.slice(0, 80)}...`);
    return;
  }

  await runClaude({
    prompt: options.prompt,
    workingDir: options.cwd,
    model: options.model,
    onData: (chunk) => {
      try {
        process.stdout.write(chunk);
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
        process.stdout.write(chunk);
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

  if (shouldSkipClaude()) {
    logStdout(`[dry-run] ${agentId}: ${prompt.slice(0, 120)}...`);
    return '';
  }

  let buffered = '';
  const result = await runClaude({
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
