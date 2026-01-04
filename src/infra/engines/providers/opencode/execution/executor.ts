import { runOpenCode } from './runner.js';
import { renderToChalk } from '../../../../../shared/formatters/outputMarkers.js';

export interface RunAgentOptions {
  abortSignal?: AbortSignal;
  logger?: (chunk: string) => void;
  stderrLogger?: (chunk: string) => void;
  timeout?: number;
  model?: string;
  agent?: string;
}

export function shouldSkipOpenCode(): boolean {
  return process.env.CODEMACHINE_SKIP_OPENCODE === '1';
}

export async function runOpenCodePrompt(options: {
  agentId: string;
  prompt: string;
  cwd: string;
  model?: string;
  agent?: string;
}): Promise<void> {
  if (shouldSkipOpenCode()) {
    console.log(`[dry-run] ${options.agentId}: ${options.prompt.slice(0, 80)}...`);
    return;
  }

  await runOpenCode({
    prompt: options.prompt,
    workingDir: options.cwd,
    model: options.model,
    agent: options.agent,
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

  if (shouldSkipOpenCode()) {
    logStdout(`[dry-run] ${agentId}: ${prompt.slice(0, 120)}...`);
    return '';
  }

  let buffered = '';
  const result = await runOpenCode({
    prompt,
    workingDir: cwd,
    model: options.model,
    agent: options.agent,
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
