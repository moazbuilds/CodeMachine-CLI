import '../shared/runtime/suppress-baseline-warning.js';

// EARLY LOGGING SETUP - Initialize before anything else
import * as path from 'node:path';
import { setAppLogFile, appDebug } from '../shared/logging/logger.js';

const earlyCwd = process.env.CODEMACHINE_CWD || process.cwd();
const earlyLogLevel = (process.env.LOG_LEVEL || '').trim().toLowerCase();
const earlyDebugFlag = (process.env.DEBUG || '').trim().toLowerCase();
const earlyDebugEnabled = earlyLogLevel === 'debug' || (earlyDebugFlag !== '' && earlyDebugFlag !== '0' && earlyDebugFlag !== 'false');
if (earlyDebugEnabled) {
  const appDebugLogPath = path.join(earlyCwd, '.codemachine', 'logs', 'app-debug.log');
  setAppLogFile(appDebugLogPath);
}
appDebug('[Boot] CLI module loading started');

// ENSURE DEFAULT PACKAGES (fast sync check — no I/O if already installed)
appDebug('[Boot] Checking default packages');
import { ensureDefaultPackagesSync } from '../shared/imports/auto-import.js';
const allDefaultsPresent = ensureDefaultPackagesSync();
appDebug('[Boot] Default packages present: %s', allDefaultsPresent);

// IMMEDIATE SPLASH - Only show for main TUI session
// Skip splash for: subcommands, help flags, or version flags
appDebug('[Boot] Checking splash screen conditions');
const args = process.argv.slice(2);
appDebug('[Boot] args=%o', args);
const hasSubcommand = args.length > 0 && !args[0].startsWith('-');
const hasHelpOrVersion = args.some(arg =>
  arg === '--help' || arg === '-h' || arg === '--version' || arg === '-V'
);
const shouldSkipSplash = hasSubcommand || hasHelpOrVersion;
appDebug('[Boot] hasSubcommand=%s, hasHelpOrVersion=%s, shouldSkipSplash=%s', hasSubcommand, hasHelpOrVersion, shouldSkipSplash);

// EARLY HOME DIRECTORY BLOCKER - Check before splash screen
// Parse --dir/-d manually since commander hasn't run yet
const dirArgIndex = args.findIndex(arg => arg === '--dir' || arg === '-d');
const explicitDir = dirArgIndex !== -1 ? args[dirArgIndex + 1] : null;
const targetCwd = explicitDir || earlyCwd;
const home = homedir();
appDebug('[Boot] Home directory check: targetCwd=%s, home=%s', targetCwd, home);

try {
  const resolvedTarget = realpathSync(targetCwd);
  const resolvedHome = realpathSync(home);
  if (resolvedTarget === resolvedHome) {
    appDebug('[Boot] Blocked: attempted to run from home directory');
    const cyan = '\x1b[36m';
    const dim = '\x1b[2m';
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    console.error('');
    console.error(`${dim}───────────────────────────────────────────────${reset}`);
    console.error(`${bold}  Cannot run from home directory${reset}`);
    console.error(`${dim}───────────────────────────────────────────────${reset}`);
    console.error('');
    console.error('  CodeMachine needs to run in a project directory,');
    console.error('  not directly in your home folder.');
    console.error('');
    console.error(`  ${dim}Try:${reset}`);
    console.error(`    ${cyan}cd ~/your-project${reset}`);
    console.error(`    ${cyan}codemachine${reset}`);
    console.error('');
    console.error(`  ${dim}Or specify a directory:${reset}`);
    console.error(`    ${cyan}codemachine --dir ~/your-project${reset}`);
    console.error('');
    process.exit(1);
  }
} catch (err) {
  appDebug('[Boot] Home directory check failed: %s', err);
  // Continue - directory might not exist yet
}

if (process.stdout.isTTY && !shouldSkipSplash) {
  appDebug('[Boot] Showing splash screen');
  const { rows = 24, columns = 80 } = process.stdout;
  const centerY = Math.floor(rows / 2);
  const centerX = Math.floor(columns / 2);
  process.stdout.write('\x1b[2J\x1b[H\x1b[?25l'); // Clear, home, hide cursor
  process.stdout.write(`\x1b[${centerY};${centerX - 6}H`);
  process.stdout.write('\x1b[38;2;224;230;240mCode\x1b[1mMachine\x1b[0m');
  process.stdout.write(`\x1b[${centerY + 1};${centerX - 6}H`);
  process.stdout.write('\x1b[38;2;0;217;255m━━━━━━━━━━━━\x1b[0m');
  appDebug('[Boot] Splash screen displayed');
}

appDebug('[Boot] Importing remaining modules');
import { Command } from 'commander';
import { realpathSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
appDebug('[Boot] Imports complete');

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

/**
 * Background initialization - runs AFTER TUI is visible
 * Loads heavy modules and performs I/O operations while user reads UI
 * Note: .codemachine folder initialization is handled by workflow run, not here
 */
async function initializeInBackground(cwd: string): Promise<void> {
  // Ensure default packages are installed (async — will clone if missing)
  appDebug('[Init] Ensuring default packages');
  const { ensureDefaultPackages, checkDefaultPackageUpdates } = await import('../shared/imports/auto-import.js');
  await ensureDefaultPackages();
  checkDefaultPackageUpdates().catch(err => appDebug('[Init] Default package update check error: %s', err));

  // Check for CLI updates
  appDebug('[Init] Checking for updates');
  const { check } = await import('../shared/updates/index.js');
  check().catch(err => appDebug('[Init] Update check error: %s', err));

  const cmRoot = path.join(cwd, '.codemachine');

  // Only bootstrap if .codemachine doesn't exist
  if (!existsSync(cmRoot)) {
    appDebug('[Init] Bootstrapping workspace (first run)');
    // Lazy load bootstrap utilities (only on first run)
    const { ensureWorkspaceStructure } = await import('./services/workspace/index.js');

    await ensureWorkspaceStructure({ cwd });
    appDebug('[Init] Workspace bootstrapped');
  }

  // Lazy load and initialize engine registry
  appDebug('[Init] Loading engine registry');
  const { registry } = await import('../infra/engines/index.js');
  const engines = registry.getAll();

  // Sync engine configs in background
  appDebug('[Init] Syncing %d engine configs', engines.length);
  for (const engine of engines) {
    if (engine.syncConfig) {
      await engine.syncConfig();
    }
  }
  appDebug('[Init] Background initialization complete');
}

export async function runCodemachineCli(argv: string[] = process.argv): Promise<void> {
  appDebug('[CLI] runCodemachineCli started');

  // Import version from auto-generated version file (works in compiled binaries)
  appDebug('[CLI] Importing version');
  const { VERSION } = await import('./version.js');
  appDebug('[CLI] VERSION=%s', VERSION);

  const program = new Command()
    .name('codemachine')
    .version(VERSION)
    .description('Codemachine multi-agent CLI orchestrator')
    .option('-d, --dir <path>', 'Target workspace directory', process.cwd())
    .option('--spec <path>', 'Path to the planning specification file', DEFAULT_SPEC_PATH)
    .action(async (options) => {
      appDebug('[CLI] Action handler entered');
      // Set CWD immediately (lightweight, no I/O)
      const cwd = options.dir || process.cwd();
      process.env.CODEMACHINE_CWD = cwd;
      if (options.spec && options.spec !== DEFAULT_SPEC_PATH) {
        process.env.CODEMACHINE_SPEC_PATH = path.resolve(cwd, options.spec);
      }
      appDebug('[CLI] CWD set to %s', cwd);

      // Start background initialization (non-blocking, fire-and-forget)
      // This runs while TUI is visible and user is reading/thinking
      appDebug('[CLI] Starting background initialization');
      initializeInBackground(cwd).catch(err => {
        appDebug('[CLI] Background init error: %s', err);
        console.error('[Background Init Error]', err);
      });

      // Launch TUI immediately - don't wait for background init
      // Import via launcher to scope SolidJS transform to TUI only
      appDebug('[CLI] Importing TUI launcher');
      const { startTUI } = await import('../cli/tui/launcher.js');
      appDebug('[CLI] TUI launcher imported, calling startTUI()');
      try {
        await startTUI();
        appDebug('[CLI] TUI exited normally');
      } catch (tuiError) {
        appDebug('[CLI] TUI error: %s', tuiError);
        throw tuiError;
      }
    });

  // Lazy load CLI commands only if user uses subcommands
  if (argv.length > 2 && !argv[2].startsWith('-')) {
    appDebug('[CLI] Loading subcommands');
    const { registerCli } = await import('../cli/index.js');
    await registerCli(program);
    appDebug('[CLI] Subcommands registered');
  }

  appDebug('[CLI] Parsing command line');
  await program.parseAsync(argv);
  appDebug('[CLI] Command line parsed');
}

appDebug('[Boot] Checking shouldRunCli');
const shouldRunCli = (() => {
  const entry = process.argv[1];
  appDebug('[Boot] entry=%s', entry);
  if (!entry) {
    appDebug('[Boot] No entry, returning false');
    return false;
  }

  // For compiled binaries, Bun.main will be the binary itself
  if (typeof Bun !== 'undefined' && Bun.main) {
    appDebug('[Boot] Checking Bun.main');
    try {
      const mainPath = fileURLToPath(Bun.main);
      const modulePath = fileURLToPath(import.meta.url);
      appDebug('[Boot] mainPath=%s, modulePath=%s', mainPath, modulePath);
      if (mainPath === modulePath) {
        appDebug('[Boot] Bun.main matches, returning true');
        return true;
      }
    } catch (err) {
      appDebug('[Boot] Bun.main check failed: %s', err);
      // Continue to other checks
    }
  }

  try {
    const resolvedEntry = realpathSync(entry);
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    appDebug('[Boot] resolvedEntry=%s, modulePath=%s', resolvedEntry, modulePath);
    const matches = resolvedEntry === modulePath;
    appDebug('[Boot] realpathSync matches=%s', matches);
    return matches;
  } catch (err) {
    appDebug('[Boot] realpathSync failed: %s, using fallback', err);
    // Fallback: if entry contains 'index' or 'codemachine', run CLI
    const fallback = entry.includes('index') || entry.includes('codemachine');
    appDebug('[Boot] fallback result=%s', fallback);
    return fallback;
  }
})();

appDebug('[Boot] shouldRunCli=%s', shouldRunCli);

if (shouldRunCli) {
  appDebug('[Boot] Calling runCodemachineCli()');
  runCodemachineCli().catch((error) => {
    appDebug('[Boot] runCodemachineCli error: %s', error);
    console.error(error);
    process.exitCode = 1;
  });
} else {
  appDebug('[Boot] CLI not run (shouldRunCli=false)');
}
