import { createRequire } from 'module';
import { Command } from 'commander';
import {
  registerTemplatesCommand,
  registerAuthCommands,
  registerRunCommand,
  registerStepCommand,
  registerAgentsCommand,
  registerImportCommand,
  registerExportCommand,
  registerMCPCommand,
  registerSayCommand,
  registerNarrateCommand,
} from './commands/index.js';
import { resolvePackageJson } from '../shared/runtime/root.js';

export async function registerCli(program: Command): Promise<void> {
  const packageJsonPath = resolvePackageJson(import.meta.url, 'CLI module');
  program
    .command('version')
    .description('Display CLI version')
    .action(() => {
      const require = createRequire(import.meta.url);
      const pkg = require(packageJsonPath) as { version: string };
      console.log(`CodeMachine v${pkg.version}`);
    });

  registerMCPCommand(program);
  registerTemplatesCommand(program);
  registerAuthCommands(program);
  registerAgentsCommand(program);
  registerImportCommand(program);
  registerExportCommand(program);
  registerSayCommand(program);
  registerNarrateCommand(program);
  await registerRunCommand(program);
  await registerStepCommand(program);
}
