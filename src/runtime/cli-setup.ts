import '../shared/runtime/suppress-baseline-warning.js';

// Boot timing - capture start time immediately
const bootStartTime = performance.now();

// EARLY LOGGING SETUP - Initialize before anything else
import * as path from 'node:path';
import { setAppLogFile, otel_info, otel_warn, otel_error } from '../shared/logging/logger.js';
import { LOGGER_NAMES } from '../shared/logging/otel-logger.js';

const earlyCwd = process.env.CODEMACHINE_CWD || process.cwd();
const earlyLogLevel = (process.env.LOG_LEVEL || '').trim().toLowerCase();
const earlyDebugFlag = (process.env.DEBUG || '').trim().toLowerCase();
const earlyDebugEnabled = earlyLogLevel === 'debug' || (earlyDebugFlag !== '' && earlyDebugFlag !== '0' && earlyDebugFlag !== 'false');
if (earlyDebugEnabled) {
  const appDebugLogPath = path.join(earlyCwd, '.codemachine', 'logs', 'app-debug.log');
  setAppLogFile(appDebugLogPath);
}

// OTEL LOGGING INITIALIZATION - Initialize early to capture all boot logs
const { initOTelLogging, shutdownOTelLogging } = await import('../shared/logging/otel-init.js');
await initOTelLogging();

const otelInitTime = performance.now();
otel_info(LOGGER_NAMES.BOOT, 'CLI boot started', []);

// ENSURE EMBEDDED RESOURCES EARLY (BEFORE IMPORTS)
import { ensure as ensureResources } from '../shared/runtime/embed.js';

const embeddedRoot = await ensureResources();
const embedTime = performance.now();

if (embeddedRoot) {
  otel_info(LOGGER_NAMES.BOOT, 'Running from embedded binary: %s', [embeddedRoot]);
  process.env.CODEMACHINE_INSTALL_DIR = embeddedRoot;
} else if (!process.env.CODEMACHINE_INSTALL_DIR) {
  const { resolvePackageRoot } = await import('../shared/runtime/root.js');
  try {
    const packageRoot = resolvePackageRoot(import.meta.url, 'cli-setup');
    process.env.CODEMACHINE_INSTALL_DIR = packageRoot;
    otel_info(LOGGER_NAMES.BOOT, 'Running from source, install directory: %s', [packageRoot]);
  } catch (err) {
    otel_warn(LOGGER_NAMES.BOOT, 'Failed to resolve package root: %s', [err]);
  }
}

// TRACING INITIALIZATION
otel_info(LOGGER_NAMES.BOOT, 'Initializing tracing...', []);
const { initTracing, shutdownTracing } = await import('../shared/tracing/index.js');
const tracingConfig = await initTracing();
const tracingInitTime = performance.now();
otel_info(LOGGER_NAMES.BOOT, 'Tracing initialized in %dms, enabled: %s, level: %s, exporter: %s',
  [Math.round(tracingInitTime - embedTime), !!tracingConfig, tracingConfig?.level ?? 'n/a', tracingConfig?.exporter ?? 'n/a']);

// METRICS INITIALIZATION
otel_info(LOGGER_NAMES.BOOT, 'Initializing metrics...', []);
const { initMetrics, shutdownMetrics } = await import('../shared/metrics/index.js');
const metricsEnabled = await initMetrics();
const metricsInitTime = performance.now();
otel_info(LOGGER_NAMES.BOOT, 'Metrics initialized in %dms, enabled: %s',
  [Math.round(metricsInitTime - tracingInitTime), metricsEnabled]);

// Create boot timing histogram after metrics are initialized
let bootHistogram: import('@opentelemetry/api').Histogram | null = null;
if (metricsEnabled) {
  const { getProcessMeter } = await import('../shared/metrics/index.js');
  const meter = getProcessMeter();
  bootHistogram = meter.createHistogram('boot.phase_duration', {
    description: 'Duration of boot phases in milliseconds',
    unit: 'ms',
  });

  // Record early boot phases
  bootHistogram.record(otelInitTime - bootStartTime, { 'boot.phase': 'otel_logging_init' });
  bootHistogram.record(embedTime - otelInitTime, { 'boot.phase': 'embed_resources' });
  bootHistogram.record(tracingInitTime - embedTime, { 'boot.phase': 'tracing_init' });
  bootHistogram.record(metricsInitTime - tracingInitTime, { 'boot.phase': 'metrics_init' });
}

if (tracingConfig) {
  process.on('beforeExit', async () => {
    await shutdownOTelLogging();
    await shutdownMetrics();
    await shutdownTracing();
  });

  const handleSignal = (signal: string) => {
    otel_info(LOGGER_NAMES.BOOT, 'Received %s, shutting down telemetry', [signal]);
    shutdownOTelLogging()
      .then(() => shutdownMetrics())
      .then(() => shutdownTracing())
      .finally(() => {
        process.exit(0);
      });
  };
  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}


// Import CLI tracer after tracing is initialized
const { getCliTracer, withSpan, withSpanSync } = await import('../shared/tracing/index.js');
const cliTracer = getCliTracer();

// SPLASH SCREEN
const args = process.argv.slice(2);
const hasSubcommand = args.length > 0 && !args[0].startsWith('-');
const hasHelpOrVersion = args.some(arg =>
  arg === '--help' || arg === '-h' || arg === '--version' || arg === '-V'
);
const shouldSkipSplash = hasSubcommand || hasHelpOrVersion;

const splashStartTime = performance.now();
const splashShown = process.stdout.isTTY && !shouldSkipSplash;
withSpanSync(cliTracer, 'cli.boot.splash_write', (span) => {
  span.setAttribute('cli.splash.shown', splashShown);
  if (splashShown) {
    otel_info(LOGGER_NAMES.BOOT, 'Writing splash screen to terminal', []);
    const { rows = 24, columns = 80 } = process.stdout;
    const centerY = Math.floor(rows / 2);
    const centerX = Math.floor(columns / 2);
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');
    process.stdout.write(`\x1b[${centerY};${centerX - 6}H`);
    process.stdout.write('\x1b[38;2;224;230;240mCode\x1b[1mMachine\x1b[0m');
    process.stdout.write(`\x1b[${centerY + 1};${centerX - 6}H`);
    process.stdout.write('\x1b[38;2;0;217;255m━━━━━━━━━━━━\x1b[0m');
  } else {
    otel_info(LOGGER_NAMES.BOOT, 'Splash screen skipped (subcommand=%s, help/version=%s, tty=%s)',
      [hasSubcommand, hasHelpOrVersion, process.stdout.isTTY]);
  }
});
const splashEndTime = performance.now();
bootHistogram?.record(splashEndTime - splashStartTime, { 'boot.phase': 'splash_write' });

import { Command } from 'commander';
import { realpathSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const importsEndTime = performance.now();
bootHistogram?.record(importsEndTime - splashEndTime, { 'boot.phase': 'cli_deps_import' });
otel_info(LOGGER_NAMES.BOOT, 'CLI dependencies loaded in %dms (commander, node:fs, node:url)', [Math.round(importsEndTime - splashEndTime)]);

// TODO: Move spec path handling to template level, not cli-setup level
// const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

/**
 * Lazy loading - runs AFTER TUI is visible
 *
 * Loads non-critical services in 3 parts:
 * 1. Check for updates
 * 2. Load engine registry
 * 3. Sync engine configs
 */
async function initializeInBackground(cwd: string): Promise<void> {
  return withSpan(cliTracer, 'cli.init.lazy_loading', async (span) => {
    span.setAttribute('cli.workspace.path', cwd);
    const bgStartTime = performance.now();

    // 1. Check for updates
    await withSpan(cliTracer, 'cli.init.updates', async (updateSpan) => {
      otel_info(LOGGER_NAMES.CLI, 'Checking for updates...', []);
      const { check } = await import('../shared/updates/index.js');
      check().catch(err => {
        otel_warn(LOGGER_NAMES.CLI, 'Update check error: %s', [err]);
        updateSpan.setAttribute('cli.init.updates.error', String(err));
      });
    });

    // LEGACY: Workspace bootstrap - now handled by workflows (preflight.ts, run.ts)
    // TODO: Remove this block once confirmed unused
    // const cmRoot = path.join(cwd, '.codemachine');
    // if (!existsSync(cmRoot)) {
    //   await withSpan(cliTracer, 'cli.init.workspace', async (wsSpan) => {
    //     wsSpan.setAttribute('cli.init.workspace.first_run', true);
    //     otel_info(LOGGER_NAMES.CLI, 'First run detected, bootstrapping workspace...', []);
    //     const { ensureWorkspaceStructure } = await import('./services/workspace/index.js');
    //     await ensureWorkspaceStructure({ cwd });
    //     otel_info(LOGGER_NAMES.CLI, 'Workspace bootstrapped at: %s', [cmRoot]);
    //   });
    // }

    // 2. Load engine registry
    const engines = await withSpan(cliTracer, 'cli.init.engines', async (engSpan) => {
      otel_info(LOGGER_NAMES.CLI, 'Loading engine registry...', []);
      const { registry } = await import('../infra/engines/index.js');
      const allEngines = registry.getAll();
      engSpan.setAttribute('cli.init.engines.count', allEngines.length);
      otel_info(LOGGER_NAMES.CLI, 'Loaded %d engines', [allEngines.length]);
      return allEngines;
    });

    // 3. Sync engine configs
    const enginesWithConfig = engines.filter(e => e.syncConfig);
    if (enginesWithConfig.length > 0) {
      otel_info(LOGGER_NAMES.CLI, 'Syncing configs for %d engines...', [enginesWithConfig.length]);
      for (const engine of enginesWithConfig) {
        await withSpan(cliTracer, 'cli.init.engine_sync', async (syncSpan) => {
          syncSpan.setAttribute('cli.init.engine.name', engine.metadata.name);
          await engine.syncConfig!();
        });
      }
    }

    const bgEndTime = performance.now();
    otel_info(LOGGER_NAMES.CLI, 'Lazy loading complete in %dms', [Math.round(bgEndTime - bgStartTime)]);
  });
}

export async function runCodemachineCli(argv: string[] = process.argv): Promise<void> {
  return withSpan(cliTracer, 'cli.boot', async (bootSpan) => {
    const cliArgs = argv.slice(2);
    bootSpan.setAttribute('cli.args', JSON.stringify(cliArgs));
    bootSpan.setAttribute('cli.cwd', process.cwd());
    otel_info(LOGGER_NAMES.CLI, 'CLI invoked with args: %s', [cliArgs.join(' ') || '(none)']);

    const VERSION = await withSpan(cliTracer, 'cli.boot.version', async (verSpan) => {
      const { VERSION: ver } = await import('./version.js');
      verSpan.setAttribute('cli.version', ver);
      otel_info(LOGGER_NAMES.CLI, 'CodeMachine v%s', [ver]);
      return ver;
    });

    const program = new Command()
      .name('codemachine')
      .version(VERSION)
      .description('Codemachine multi-agent CLI orchestrator')
      .option('-d, --dir <path>', 'Target workspace directory', process.cwd())
      // TODO: Move spec path handling to template level
      // .option('--spec <path>', 'Path to the planning specification file', DEFAULT_SPEC_PATH)
      .action(async (options) => {
        const cwd = options.dir || process.cwd();
        process.env.CODEMACHINE_CWD = cwd;
        otel_info(LOGGER_NAMES.CLI, 'Workspace directory: %s', [cwd]);

        // TODO: Move spec path handling to template level
        // if (options.spec && options.spec !== DEFAULT_SPEC_PATH) {
        //   const specPath = path.resolve(cwd, options.spec);
        //   process.env.CODEMACHINE_SPEC_PATH = specPath;
        //   otel_info(LOGGER_NAMES.CLI, 'Using custom spec path: %s', [specPath]);
        // } else {
        //   otel_info(LOGGER_NAMES.CLI, 'Using default spec path: %s', [DEFAULT_SPEC_PATH]);
        // }

        // Start background initialization
        initializeInBackground(cwd).catch(err => {
          otel_error(LOGGER_NAMES.CLI, 'Lazy loading error: %s', [err]);
          console.error('[Lazy Loading Error]', err);
        });

        // Launch TUI
        await withSpan(cliTracer, 'cli.tui.launch', async (tuiSpan) => {
          const tuiStartTime = performance.now();
          otel_info(LOGGER_NAMES.TUI, 'Loading TUI launcher...', []);
          const { startTUI } = await import('../cli/tui/launcher.js');

          const tuiImportTime = performance.now();
          const importDuration = Math.round(tuiImportTime - tuiStartTime);
          bootHistogram?.record(importDuration, { 'boot.phase': 'tui_import' });
          tuiSpan.setAttribute('cli.tui.import_duration_ms', importDuration);
          otel_info(LOGGER_NAMES.TUI, 'TUI launcher loaded in %dms, starting...', [importDuration]);

          // Record boot duration before TUI starts
          const bootDurationPreTui = performance.now() - bootStartTime;
          bootHistogram?.record(bootDurationPreTui, { 'boot.phase': 'boot_duration_pre_tui' });
          tuiSpan.setAttribute('cli.boot.duration_pre_tui_ms', bootDurationPreTui);
          otel_info(LOGGER_NAMES.BOOT, 'Boot duration (pre-TUI): %dms', [Math.round(bootDurationPreTui)]);

          try {
            // TODO: Move session duration tracking to app.tsx onExit handler
            // const tuiSessionStart = performance.now();
            await startTUI();
            // const tuiSessionDuration = performance.now() - tuiSessionStart;
            // otel_info(LOGGER_NAMES.TUI, 'TUI session ended after %dms', [Math.round(tuiSessionDuration)]);

            // Clear main buffer after TUI exits (removes splash from scrollback)
            if (splashShown && process.stdout.isTTY) {
              // \x1b[2J = clear screen, \x1b[3J = clear scrollback, \x1b[H = cursor home, \x1b[?25h = show cursor
              process.stdout.write('\x1b[2J\x1b[3J\x1b[H\x1b[?25h');
            }
          } catch (tuiError) {
            otel_error(LOGGER_NAMES.TUI, 'TUI error: %s', [tuiError]);
            throw tuiError;
          }
        });
      });

    // Lazy load CLI commands for subcommands
    if (argv.length > 2 && !argv[2].startsWith('-')) {
      await withSpan(cliTracer, 'cli.boot.subcommands', async (subSpan) => {
        const subcommand = argv[2];
        subSpan.setAttribute('cli.subcommand', subcommand);
        otel_info(LOGGER_NAMES.CLI, 'Loading subcommand: %s', [subcommand]);
        const { registerCli } = await import('../cli/index.js');
        await registerCli(program);
        otel_info(LOGGER_NAMES.CLI, 'Subcommands registered', []);
      });
    }

    otel_info(LOGGER_NAMES.CLI, 'Processing CLI arguments via Commander...', []);
    await withSpan(cliTracer, 'cli.command.parse', async () => {
      await program.parseAsync(argv);
    });

    // Record total session time (boot + TUI session)
    const totalSessionTime = performance.now() - bootStartTime;
    bootSpan.setAttribute('cli.session.total_duration_ms', totalSessionTime);
    otel_info(LOGGER_NAMES.BOOT, 'Session ended, total duration: %dms', [Math.round(totalSessionTime)]);
  });
}

const shouldRunCli = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  if (typeof Bun !== 'undefined' && Bun.main) {
    try {
      const mainPath = fileURLToPath(Bun.main);
      const modulePath = fileURLToPath(import.meta.url);
      if (mainPath === modulePath) {
        return true;
      }
    } catch (err) {
      otel_warn(LOGGER_NAMES.BOOT, 'Bun.main check failed: %s', [err]);
    }
  }

  try {
    const resolvedEntry = realpathSync(entry);
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return resolvedEntry === modulePath;
  } catch (err) {
    otel_warn(LOGGER_NAMES.BOOT, 'realpathSync failed, using fallback: %s', [err]);
    return entry.includes('index') || entry.includes('codemachine');
  }
})();

if (shouldRunCli) {
  let exitCode = 0;
  try {
    await runCodemachineCli();
  } catch (error) {
    otel_error(LOGGER_NAMES.BOOT, 'CLI error: %s', [error]);
    console.error(error);
    exitCode = 1;
  } finally {
    await shutdownOTelLogging();
    await shutdownMetrics();
    await shutdownTracing();
    process.exit(exitCode);
  }
}
