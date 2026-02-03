import '../shared/runtime/suppress-baseline-warning.js';

import { setAppLogFile, appDebug } from '../shared/logging/logger.js';
import * as path from 'node:path';
import { Command } from 'commander';

// Early logging setup
const earlyCwd = process.env.CODEMACHINE_CWD || process.cwd();
const earlyLogLevel = (process.env.LOG_LEVEL || '').trim().toLowerCase();
const earlyDebugFlag = (process.env.DEBUG || '').trim().toLowerCase();
const earlyDebugEnabled = earlyLogLevel === 'debug' || (earlyDebugFlag !== '' && earlyDebugFlag !== '0' && earlyDebugFlag !== 'false');
if (earlyDebugEnabled) {
  const appDebugLogPath = path.join(earlyCwd, '.codemachine', 'logs', 'app-debug.log');
  setAppLogFile(appDebugLogPath);
}
appDebug('[Boot] CLI module loading started');

export async function runCodemachineCli(argv: string[] = process.argv): Promise<void> {
  appDebug('[CLI] runCodemachineCli started');

  const { VERSION } = await import('./version.js');
  appDebug('[CLI] VERSION=%s', VERSION);

  const program = new Command()
    .name('codemachine')
    .version(VERSION)
    .description('Codemachine CLI');

  // Register subcommands
  const { registerCli } = await import('../cli/index.js');
  await registerCli(program);

  await program.parseAsync(argv);
}

runCodemachineCli().catch((error) => {
  appDebug('[Boot] runCodemachineCli error: %s', error);
  console.error(error);
  process.exitCode = 1;
});
