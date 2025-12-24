import * as path from 'node:path';

import { runMistral } from './runner.js';
import { MemoryAdapter } from '../../../../fs/memory-adapter.js';
import { MemoryStore } from '../../../../../agents/index.js';

export interface RunAgentOptions {
  abortSignal?: AbortSignal;
  logger?: (chunk: string) => void;
  stderrLogger?: (chunk: string) => void;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
  model?: string; // Model to use (e.g., 'devstral-2', 'mistral-large', 'mistral-medium', 'mistral-small')
}

export function shouldSkipMistral(): boolean {
  return process.env.CODEMACHINE_SKIP_MISTRAL === '1';
}

export async function runMistralPrompt(options: {
  agentId: string;
  prompt: string;
  cwd: string;
  model?: string;
}): Promise<void> {
  if (shouldSkipMistral()) {
    console.log(`[dry-run] ${options.agentId}: ${options.prompt.slice(0, 80)}...`);
    return;
  }

  await runMistral({
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

  if (shouldSkipMistral()) {
    logStdout(`[dry-run] ${agentId}: ${prompt.slice(0, 120)}...`);
    return '';
  }

  let buffered = '';
  const result = await runMistral({
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
  try {
    const memoryDir = path.resolve(cwd, '.codemachine', 'memory');
    const adapter = new MemoryAdapter(memoryDir);
    const store = new MemoryStore(adapter);
    if (stdout.trim()) {
      await store.append({ agentId, content: stdout, timestamp: new Date().toISOString() });
    }
  } catch {
    // best-effort memory persistence
  }
  return stdout;
}

