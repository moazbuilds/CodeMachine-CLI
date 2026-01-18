/**
 * Export command for CodeMachine
 *
 * Usage:
 *   codemachine export    Shows the imports folder path
 */

import type { Command } from 'commander';
import { getImportsDir, ensureImportsDir } from '../../shared/imports/index.js';

/**
 * Run the export command
 */
function runExportCommand(): void {
  ensureImportsDir();
  const importsDir = getImportsDir();
  console.log(`Imports can be accessed manually from: ${importsDir}`);
}

/**
 * Register the export command with Commander
 */
export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Open the imports folder in file explorer')
    .action(() => {
      runExportCommand();
    });
}
