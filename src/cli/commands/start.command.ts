import * as path from 'node:path';
import type { Command } from 'commander';

import { runWorkflowQueue } from '../../workflows/index.js';
import { debug } from '../../shared/logging/logger.js';

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

type StartCommandOptions = {
  spec?: string;
};

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Run the workflow queue until completion (non-interactive)')
    .option('--spec <path>', 'Path to the planning specification file')
    .action(async (options: StartCommandOptions, command: Command) => {
      const cwd = process.env.CODEMACHINE_CWD || process.cwd();

      // Use command-specific --spec if provided, otherwise fall back to global --spec, then default
      const globalOpts = command.optsWithGlobals ? command.optsWithGlobals() : command.opts();
      const specPath = options.spec ?? globalOpts.spec ?? DEFAULT_SPEC_PATH;
      const specificationPath = path.resolve(cwd, specPath);

      debug(`Starting workflow (spec: ${specificationPath})`);

      try {
        await runWorkflowQueue({ cwd, specificationPath });
        console.log('\n✓ Workflow completed successfully');
        process.exit(0);
      } catch (error) {
        console.error('\n✗ Workflow failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
