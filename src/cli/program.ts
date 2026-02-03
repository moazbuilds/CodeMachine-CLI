import { Command } from 'commander';
import {
  registerSayCommand,
  registerNarrateCommand,
} from './commands/index.js';

export async function registerCli(program: Command): Promise<void> {
  registerSayCommand(program);
  registerNarrateCommand(program);
}
