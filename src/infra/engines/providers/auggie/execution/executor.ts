import { runAuggie } from './runner.js';
import { renderToChalk } from '../../../../../shared/formatters/outputMarkers.js';

function shouldSkipAuggie(): boolean {
  return (process.env.CODEMACHINE_SKIP_AUGGIE || '').toString() === '1';
}

export async function runAuggiePrompt(options: {
  agentId: string;
  prompt: string;
  cwd: string;
  model?: string;
}): Promise<void> {
  if (shouldSkipAuggie()) {
    console.log(`[dry-run] ${options.agentId}: ${options.prompt.slice(0, 80)}...`);
    return;
  }

  await runAuggie({
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

