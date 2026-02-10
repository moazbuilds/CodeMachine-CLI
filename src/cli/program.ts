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
} from './commands/index.js';
import { VERSION } from '../runtime/version.js';

export async function registerCli(program: Command): Promise<void> {
  program
    .command('version')
    .description('Display CLI version')
    .action(() => {
      console.log(`CodeMachine v${VERSION}`);
    });

  registerMCPCommand(program);
  registerTemplatesCommand(program);
  registerAuthCommands(program);
  registerAgentsCommand(program);
  registerImportCommand(program);
  registerExportCommand(program);
  await registerRunCommand(program);
  await registerStepCommand(program);
}
