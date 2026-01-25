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

// ENSURE EMBEDDED RESOURCES EARLY (BEFORE IMPORTS)
// This must run before any modules that might resolve the package root
appDebug('[Boot] Importing embed module');
import { ensure as ensureResources } from '../shared/runtime/embed.js';

appDebug('[Boot] Ensuring embedded resources');
const embeddedRoot = await ensureResources();
appDebug('[Boot] embeddedRoot=%s', embeddedRoot);

if (!embeddedRoot && !process.env.CODEMACHINE_INSTALL_DIR) {
  // Fallback to normal resolution if not embedded
  appDebug('[Boot] Resolving package root (fallback)');
  const { resolvePackageRoot } = await import('../shared/runtime/root.js');
  try {
    const packageRoot = resolvePackageRoot(import.meta.url, 'cli-setup');
    process.env.CODEMACHINE_INSTALL_DIR = packageRoot;
    appDebug('[Boot] CODEMACHINE_INSTALL_DIR=%s', packageRoot);
  } catch (err) {
    appDebug('[Boot] Failed to resolve package root: %s', err);
    // Continue without setting
  }
}

// TRACING INITIALIZATION - Initialize early to capture all spans
// Must be done before any instrumented code runs
appDebug('[Boot] Initializing tracing');
const { initTracing, shutdownTracing } = await import('../shared/tracing/index.js');
const tracingConfig = await initTracing();
if (tracingConfig) {
  appDebug('[Boot] Tracing enabled: level=%d, exporter=%s', tracingConfig.level, tracingConfig.exporter);

  // Register shutdown handlers to flush spans on exit
  // Handle normal exit
  process.on('beforeExit', async () => {
    appDebug('[Boot] Shutting down tracing (beforeExit)');
    await shutdownTracing();
  });

  // Handle signals (SIGINT = Ctrl+C, SIGTERM = kill)
  const handleSignal = (signal: string) => {
    appDebug('[Boot] Received %s, shutting down tracing', signal);
    shutdownTracing().finally(() => {
      process.exit(0);
    });
  };
  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));

  // Handle process.exit() calls
  process.on('exit', () => {
    appDebug('[Boot] Process exiting, tracing may not flush completely');
  });
} else {
  appDebug('[Boot] Tracing disabled');
}

// Import CLI tracer after tracing is initialized
appDebug('[Boot] Importing CLI tracer');
const { getCliTracer, withSpan, withSpanSync } = await import('../shared/tracing/index.js');
const cliTracer = getCliTracer();

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

const splashShown = process.stdout.isTTY && !shouldSkipSplash;
withSpanSync(cliTracer, 'cli.boot.splash', (span) => {
  span.setAttribute('cli.splash.shown', splashShown);
  if (splashShown) {
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
});

appDebug('[Boot] Importing remaining modules');
import { Command } from 'commander';
import { realpathSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
appDebug('[Boot] Imports complete');

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

/**
 * Background initialization - runs AFTER TUI is visible
 * Loads heavy modules and performs I/O operations while user reads UI
 * Note: .codemachine folder initialization is handled by workflow run, not here
 */
async function initializeInBackground(cwd: string): Promise<void> {
  return withSpan(cliTracer, 'cli.init.background', async (span) => {
    span.setAttribute('cli.workspace.path', cwd);

    // Check for updates (writes to ~/.codemachine/resources/updates.json)
    await withSpan(cliTracer, 'cli.init.updates', async (updateSpan) => {
      appDebug('[Init] Checking for updates');
      const { check } = await import('../shared/updates/index.js');
      check().catch(err => {
        appDebug('[Init] Update check error: %s', err);
        updateSpan.setAttribute('cli.init.updates.error', String(err));
      });
    });

    const cmRoot = path.join(cwd, '.codemachine');

    // Only bootstrap if .codemachine doesn't exist
    if (!existsSync(cmRoot)) {
      await withSpan(cliTracer, 'cli.init.workspace', async (wsSpan) => {
        wsSpan.setAttribute('cli.init.workspace.first_run', true);
        appDebug('[Init] Bootstrapping workspace (first run)');
        // Lazy load bootstrap utilities (only on first run)
        const { ensureWorkspaceStructure } = await import('./services/workspace/index.js');
        await ensureWorkspaceStructure({ cwd });
        appDebug('[Init] Workspace bootstrapped');
      });
    }

    // Lazy load and initialize engine registry
    const engines = await withSpan(cliTracer, 'cli.init.engines', async (engSpan) => {
      appDebug('[Init] Loading engine registry');
      const { registry } = await import('../infra/engines/index.js');
      const allEngines = registry.getAll();
      engSpan.setAttribute('cli.init.engines.count', allEngines.length);
      return allEngines;
    });

    // Sync engine configs in background
    appDebug('[Init] Syncing %d engine configs', engines.length);
    for (const engine of engines) {
      if (engine.syncConfig) {
        await withSpan(cliTracer,
          'cli.init.engine_sync',
          async (syncSpan) => {
            syncSpan.setAttribute('cli.init.engine.name', engine.metadata.name);
            await engine.syncConfig();
          });
      }
    }
    appDebug('[Init] Background initialization complete');
  });
}

export async function runCodemachineCli(argv: string[] = process.argv): Promise<void> {
  appDebug('[Trace] Starting cli.boot span');
  return withSpan(cliTracer, 'cli.boot', async (bootSpan) => {
    bootSpan.setAttribute('cli.args', JSON.stringify(argv.slice(2)));
    bootSpan.setAttribute('cli.cwd', process.cwd());
    appDebug('[Trace] Inside cli.boot span');

    appDebug('[CLI] runCodemachineCli started');

    // Import version from auto-generated version file (works in compiled binaries)
    const VERSION = await withSpan(cliTracer, 'cli.boot.version', async (verSpan) => {
      appDebug('[CLI] Importing version');
      const { VERSION: ver } = await import('./version.js');
      verSpan.setAttribute('cli.version', ver);
      appDebug('[CLI] VERSION=%s', ver);
      return ver;
    });

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
        appDebug('[Trace] Starting cli.tui.launch span');
        await withSpan(cliTracer, 'cli.tui.launch', async () => {
          appDebug('[CLI] Importing TUI launcher');
          const { startTUI } = await import('../cli/tui/launcher.js');
          appDebug('[CLI] TUI launcher imported, calling startTUI()');
          try {
            await startTUI();
            appDebug('[CLI] TUI exited normally');
            appDebug('[Trace] TUI exited normally');
          } catch (tuiError) {
            appDebug('[CLI] TUI error: %s', tuiError);
            appDebug('[Trace] TUI error: %s', tuiError);
            throw tuiError;
          }
        });
        appDebug('[Trace] cli.tui.launch span ended');
      });

    // Lazy load CLI commands only if user uses subcommands
    if (argv.length > 2 && !argv[2].startsWith('-')) {
      await withSpan(cliTracer, 'cli.boot.subcommands', async (subSpan) => {
        subSpan.setAttribute('cli.subcommand', argv[2]);
        appDebug('[CLI] Loading subcommands');
        const { registerCli } = await import('../cli/index.js');
        await registerCli(program);
        appDebug('[CLI] Subcommands registered');
      });
    }

    appDebug('[CLI] Parsing command line');
    appDebug('[Trace] Starting cli.command.parse span');
    await withSpan(cliTracer, 'cli.command.parse', async () => {
      await program.parseAsync(argv);
    });
    appDebug('[Trace] cli.command.parse span ended');
    appDebug('[CLI] Command line parsed');
    appDebug('[Trace] cli.boot span about to end');
  });
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
  let exitCode = 0;
  try {
    await runCodemachineCli();
    appDebug('[Trace] runCodemachineCli completed normally');
  } catch (error) {
    appDebug('[Boot] runCodemachineCli error: %s', error);
    appDebug('[Trace] runCodemachineCli error: %s', error);
    console.error(error);
    exitCode = 1;
  } finally {
    // Ensure tracing is flushed before exit
    appDebug('[Trace] About to shutdown tracing...');
    appDebug('[Boot] Shutting down tracing (explicit)');
    await shutdownTracing();
    appDebug('[Trace] Tracing shutdown complete');
    process.exit(exitCode);
  }
} else {
  appDebug('[Boot] CLI not run (shouldRunCli=false)');
}
