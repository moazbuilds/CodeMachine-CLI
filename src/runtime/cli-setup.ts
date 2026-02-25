import '../shared/runtime/suppress-baseline-warning.js';

// Boot timing - capture start time immediately
const bootStartTime = performance.now();

// TODO: Legacy - appDebug file bootstrap is superseded by OTel telemetry. Remove after confirming no side effects.
/*
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
*/

import { otel_info, otel_warn, otel_error } from '../shared/logging/logger.js';
import { LOGGER_NAMES } from '../shared/logging/otel-logger.js';
const earlyCwd = process.env.CODEMACHINE_CWD || process.cwd();

// TELEMETRY INITIALIZATION — skip entirely when CODEMACHINE_TRACE is not set
const traceEnv = (process.env.CODEMACHINE_TRACE || '').trim();
const telemetryRequested = traceEnv !== '' && traceEnv !== '0' && traceEnv !== 'false';

const noop = async () => {};
let shutdownOTelLogging = noop;
let shutdownTracing = noop;
let shutdownMetrics = noop;
let tracingConfig: Awaited<ReturnType<typeof import('../shared/tracing/index.js').initTracing>> | null = null;
let metricsEnabled = false;
let otelInitTime = bootStartTime;
let tracingInitTime = bootStartTime;
let metricsInitTime = bootStartTime;

if (telemetryRequested) {
  const otelMod = await import('../shared/logging/otel-init.js');
  await otelMod.initOTelLogging();
  shutdownOTelLogging = otelMod.shutdownOTelLogging;

  otelInitTime = performance.now();
  otel_info(LOGGER_NAMES.BOOT, 'CLI boot continuing after OTel logging init', []);

  otel_info(LOGGER_NAMES.BOOT, 'Initializing tracing...', []);
  const tracingMod = await import('../shared/tracing/index.js');
  tracingConfig = await tracingMod.initTracing();
  shutdownTracing = tracingMod.shutdownTracing;
  tracingInitTime = performance.now();
  otel_info(LOGGER_NAMES.BOOT, 'Tracing initialized in %dms, enabled: %s, level: %s, exporter: %s',
    [Math.round(tracingInitTime - otelInitTime), !!tracingConfig, tracingConfig?.level ?? 'n/a', tracingConfig?.exporter ?? 'n/a']);

  otel_info(LOGGER_NAMES.BOOT, 'Initializing metrics...', []);
  const metricsMod = await import('../shared/metrics/index.js');
  metricsEnabled = await metricsMod.initMetrics();
  shutdownMetrics = metricsMod.shutdownMetrics;
  metricsInitTime = performance.now();
  otel_info(LOGGER_NAMES.BOOT, 'Metrics initialized in %dms, enabled: %s',
    [Math.round(metricsInitTime - tracingInitTime), metricsEnabled]);
}

// Import tracer helpers — these are always safe (no-op when tracing not initialized)
const { getCliTracer, withSpan, withSpanSync, withRootSpan, startManualSpanAsync } = await import('../shared/tracing/index.js');
const cliTracer = getCliTracer();

// PRE-BOOT PHASE - parent span for all pre-boot operations
import { ensureDefaultPackagesSync, ensureDefaultPackages } from '../shared/imports/auto-import.js';

const { defaultPkgsTime, cliDepsEndTime, bootHistogram, splashShown, Command, realpathSync, existsSync, fileURLToPath } = await withSpan(
  cliTracer,
  'cli.preBoot',
  async (preBootSpan) => {
    // 1. HOME DIRECTORY BLOCKER
    const args = process.argv.slice(2);
    const dirArgIndex = args.findIndex((arg: string) => arg === '--dir' || arg === '-d');
    const explicitDir = dirArgIndex !== -1 ? args[dirArgIndex + 1] : null;
    const targetCwd = explicitDir || earlyCwd;
    const { homedir } = await import('node:os');
    const home = homedir();
    otel_info(LOGGER_NAMES.BOOT, 'Home directory check: targetCwd=%s, home=%s', [targetCwd, home]);

    try {
      const { realpathSync: rps2 } = await import('node:fs');
      const resolvedTarget = rps2(targetCwd);
      const resolvedHome = rps2(home);
      if (resolvedTarget === resolvedHome) {
        otel_info(LOGGER_NAMES.BOOT, 'Blocked: attempted to run from home directory', []);
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
      otel_info(LOGGER_NAMES.BOOT, 'Home directory check failed: %s', [err]);
      // Continue - directory might not exist yet
    }

    // 2. SPLASH SCREEN
    const hasSubcommand = args.length > 0 && !args[0].startsWith('-');
    const hasHelpOrVersion = args.some(arg =>
      arg === '--help' || arg === '-h' || arg === '--version' || arg === '-V'
    );
    const shouldSkipSplash = hasSubcommand || hasHelpOrVersion;

    const splashShown = process.stdout.isTTY && !shouldSkipSplash;
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
      otel_info(LOGGER_NAMES.BOOT, 'Splash screen rendered (rows=%d, cols=%d)', [rows, columns]);
    } else {
      otel_info(LOGGER_NAMES.BOOT, 'Splash screen skipped (subcommand=%s, help/version=%s, tty=%s)',
        [hasSubcommand, hasHelpOrVersion, process.stdout.isTTY]);
    }

    // 3. ENSURE DEFAULT PACKAGES (fast sync check)
    const { defaultPkgsTime, allDefaultsPresent } = await withSpan(cliTracer, 'cli.preBoot.default_packages', async (span) => {
      const allDefaultsPresent = ensureDefaultPackagesSync();
      const time = performance.now();
      otel_info(LOGGER_NAMES.BOOT, 'Default packages present: %s', [allDefaultsPresent]);
      span.setAttribute('cli.preBoot.default_packages.present', allDefaultsPresent);
      return { defaultPkgsTime: time, allDefaultsPresent };
    });

    // TODO: Misplaced concern - boot phase metric wiring should be in a dedicated boot metrics module. Move during refactoring.
    /*
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
      bootHistogram.record(otelInitTime - bootStartTime, { 'boot.phase': 'cli.preBoot.otel_logging' });
      bootHistogram.record(tracingInitTime - otelInitTime, { 'boot.phase': 'cli.preBoot.tracing' });
      bootHistogram.record(metricsInitTime - tracingInitTime, { 'boot.phase': 'cli.preBoot.metrics' });
      bootHistogram.record(defaultPkgsTime - metricsInitTime, { 'boot.phase': 'cli.preBoot.default_packages' });
    }
    */
    let bootHistogram: import('@opentelemetry/api').Histogram | null = null;

    // TODO: Misplaced concern - telemetry process lifecycle handlers should be owned by telemetry runtime initialization. Move during refactoring.
    /*
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
    */

    // BLOCKING INSTALL — if sync check found missing packages, install them now
    if (!allDefaultsPresent) {
      await withSpan(cliTracer, 'cli.preBoot.default_packages_install', async (installSpan) => {
        const { rows = 24, columns = 80 } = process.stdout;
        const centerY = Math.floor(rows / 2);
        const centerX = Math.floor(columns / 2);

        const barFull = '━━━━━━━━━━━━';
        const progressFrames = [
          barFull.slice(0, 3),
          barFull.slice(0, 6),
          barFull.slice(0, 9),
          barFull,
        ];
        let frameIdx = 0;
        let currentMsg = '';
        let spinnerInterval: ReturnType<typeof setInterval> | undefined;

        if (splashShown) {
          const drawLine = () => {
            const frame = progressFrames[frameIdx % progressFrames.length];
            const msgX = Math.max(1, centerX - Math.floor(currentMsg.length / 2));
            const barX = Math.max(1, centerX - Math.floor(frame.length / 2));
            process.stdout.write(`\x1b[${centerY + 3};1H\x1b[2K\x1b[${centerY + 3};${msgX}H\x1b[2m${currentMsg}\x1b[0m`);
            process.stdout.write(`\x1b[${centerY + 4};1H\x1b[2K\x1b[${centerY + 4};${barX}H\x1b[38;2;0;217;255m${frame}\x1b[0m`);
            frameIdx++;
          };
          drawLine();
          spinnerInterval = setInterval(drawLine, 200);
        }

        otel_info(LOGGER_NAMES.BOOT, 'Blocking install of missing default packages...', []);
        await ensureDefaultPackages((name) => {
          otel_info(LOGGER_NAMES.BOOT, 'Downloading default package: %s', [name]);
          currentMsg = `Downloading ${name} package...`;
        });

        if (spinnerInterval) clearInterval(spinnerInterval);
        if (splashShown) {
          process.stdout.write(`\x1b[${centerY + 3};1H\x1b[2K`);
          process.stdout.write(`\x1b[${centerY + 4};1H\x1b[2K`);
        }

        installSpan.setAttribute('cli.preBoot.default_packages_install.done', true);
        otel_info(LOGGER_NAMES.BOOT, 'Default packages installed', []);
      });
    }

    // CLI DEPENDENCIES - dynamic imports with span
    const { Command, realpathSync, existsSync, fileURLToPath } = await withSpan(
      cliTracer,
      'cli.preBoot.cli_deps_import',
      async (span) => {
        const { Command: Cmd } = await import('commander');
        const { realpathSync: rps, existsSync: es } = await import('node:fs');
        const { fileURLToPath: fup } = await import('node:url');

        const duration = Math.round(performance.now() - defaultPkgsTime);
        span.setAttribute('cli.preBoot.cli_deps.duration_ms', duration);
        otel_info(LOGGER_NAMES.BOOT, 'CLI dependencies import completed in %dms (commander, node:fs, node:url)', [duration]);

        return { Command: Cmd, realpathSync: rps, existsSync: es, fileURLToPath: fup };
      }
    );
    const cliDepsEndTime = performance.now();
    bootHistogram?.record(cliDepsEndTime - defaultPkgsTime, { 'boot.phase': 'cli.preBoot.cli_deps' });

    preBootSpan.setAttribute('cli.preBoot.duration_ms', Math.round(cliDepsEndTime - metricsInitTime));

    return { defaultPkgsTime, cliDepsEndTime, bootHistogram, splashShown, Command, realpathSync, existsSync, fileURLToPath };
  }
);

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
async function initializeLazy(cwd: string): Promise<void> {
  // Use withRootSpan to create an independent trace (not nested under cli.boot)
  return withRootSpan(cliTracer, 'cli.lazy', async (span) => {
    span.setAttribute('cli.lazy.workspace.path', cwd);
    const lazyStartTime = performance.now();

    // 0. Check default packages for updates (install already happened in pre-boot)
    const { checkDefaultPackageUpdates } = await import('../shared/imports/auto-import.js');
    checkDefaultPackageUpdates()
      .then(() => otel_info(LOGGER_NAMES.CLI, 'Default package update check completed', []))
      .catch(err => {
        otel_warn(LOGGER_NAMES.CLI, 'Default package update check error: %s', [err]);
      });

    // 1. Check for updates
    otel_info(LOGGER_NAMES.CLI, 'Checking for updates...', []);
    const updateStart = performance.now();
    const { check } = await import('../shared/updates/index.js');
    check()
      .then(() => {
        const ms = Math.round(performance.now() - updateStart);
        otel_info(LOGGER_NAMES.CLI, 'Update check completed successfully', []);
        otel_info(LOGGER_NAMES.CLI, 'Update check finished in %dms', [ms]);
      })
      .catch(err => {
        otel_warn(LOGGER_NAMES.CLI, 'Update check error: %s', [err]);
        otel_warn(LOGGER_NAMES.CLI, 'Update check failed after %dms', [Math.round(performance.now() - updateStart)]);
      });

    // LEGACY: Workspace bootstrap - now handled by workflows (preflight.ts, run.ts)
    // TODO: Remove this block once confirmed unused
    // const cmRoot = path.join(cwd, '.codemachine');
    // if (!existsSync(cmRoot)) {
    //   await withSpan(cliTracer, 'cli.lazy.workspace', async (wsSpan) => {
    //     wsSpan.setAttribute('cli.lazy.workspace.first_run', true);
    //     otel_info(LOGGER_NAMES.CLI, 'First run detected, bootstrapping workspace...', []);
    //     const { ensureWorkspaceStructure } = await import('./services/workspace/index.js');
    //     await ensureWorkspaceStructure({ cwd });
    //     otel_info(LOGGER_NAMES.CLI, 'Workspace bootstrapped at: %s', [cmRoot]);
    //   });
    // }

    // 2. Load engine registry
    const engines = await withSpan(cliTracer, 'cli.lazy.engines', async (engSpan) => {
      otel_info(LOGGER_NAMES.CLI, 'Loading engine registry...', []);
      const { registry } = await import('../infra/engines/index.js');
      const allEngines = registry.getAll();
      engSpan.setAttribute('cli.lazy.engines.count', allEngines.length);
      otel_info(LOGGER_NAMES.CLI, 'Loaded %d engines', [allEngines.length]);
      return allEngines;
    });

    // 3. Sync engine configs
    const enginesWithConfig = engines.filter(e => e.syncConfig);
    if (enginesWithConfig.length > 0) {
      otel_info(LOGGER_NAMES.CLI, 'Syncing configs for %d engines...', [enginesWithConfig.length]);
      for (const engine of enginesWithConfig) {
        await withSpan(cliTracer, 'cli.lazy.engine_sync', async (syncSpan) => {
          syncSpan.setAttribute('cli.lazy.engine.name', engine.metadata.name);
          await engine.syncConfig!();
        });
      }
    }

    const lazyEndTime = performance.now();
    otel_info(LOGGER_NAMES.CLI, 'Lazy loading complete in %dms', [Math.round(lazyEndTime - lazyStartTime)]);
  });
}

export async function runCodemachineCli(argv: string[] = process.argv): Promise<void> {
  // Use startManualSpanAsync to set boot span as active context (for proper nesting)
  // while still allowing manual span.end() before blocking on TUI
  await startManualSpanAsync(cliTracer, 'cli.boot', async (bootSpan) => {
    const cliArgs = argv.slice(2);
    bootSpan.setAttribute('cli.boot.args', JSON.stringify(cliArgs));
    bootSpan.setAttribute('cli.boot.cwd', process.cwd());
    otel_info(LOGGER_NAMES.CLI, 'CLI invoked with args: %s', [cliArgs.join(' ') || '(none)']);

    let bootSpanEnded = false;
    const endBootSpan = () => {
      if (!bootSpanEnded) {
        bootSpanEnded = true;
        bootSpan.end();
      }
    };

    try {
      const VERSION = await withSpan(cliTracer, 'cli.boot.version', async (verSpan) => {
        const { VERSION: ver } = await import('./version.js');
        verSpan.setAttribute('cli.boot.version', ver);
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

          // Start lazy loading (fire-and-forget)
          initializeLazy(cwd).catch(err => {
            otel_error(LOGGER_NAMES.CLI, 'Lazy loading error: %s', [err]);
          });

          // Launch TUI - use startManualSpanAsync for proper nesting under cli.boot
          const { result: startTUI, span: tuiSpan } = await startManualSpanAsync(cliTracer, 'cli.boot.tui_launcher_import', async (tuiSpan) => {
            const tuiStartTime = performance.now();
            otel_info(LOGGER_NAMES.TUI, 'Loading TUI launcher...', []);
            const { startTUI: tuiLauncher } = await import('../cli/tui/launcher.js');

            const tuiLauncherLoadTime = performance.now();
            const launcherDuration = Math.round(tuiLauncherLoadTime - tuiStartTime);
            bootHistogram?.record(launcherDuration, { 'boot.phase': 'cli.boot.tui_launcher_import' });
            tuiSpan.setAttribute('cli.boot.tui_launcher.duration_ms', launcherDuration);
            otel_info(LOGGER_NAMES.TUI, 'TUI launcher loaded, starting...', []);

            // Record boot duration before TUI starts
            const bootDurationPreTui = performance.now() - bootStartTime;
            bootHistogram?.record(bootDurationPreTui, { 'boot.phase': 'cli.boot.pre_tui' });
            tuiSpan.setAttribute('cli.boot.total_duration_ms', bootDurationPreTui);
            bootSpan.setAttribute('cli.boot.duration_ms', bootDurationPreTui);
            otel_info(LOGGER_NAMES.BOOT, 'Boot duration (pre-TUI): %dms', [Math.round(bootDurationPreTui)]);

            return tuiLauncher;
          });

          // End boot-related spans BEFORE blocking on TUI session
          tuiSpan.end();
          endBootSpan();

          try {
            await startTUI();

            // Clear main buffer after TUI exits (removes splash from scrollback)
            if (splashShown && process.stdout.isTTY) {
              // \x1b[2J = clear screen, \x1b[3J = clear scrollback, \x1b[H = cursor home, \x1b[?25h = show cursor
              process.stdout.write('\x1b[2J\x1b[3J\x1b[H\x1b[?25h');
            }

            // Log session end (informational, not in a span - session duration is not useful for tracing)
            const totalSessionTime = performance.now() - bootStartTime;
            otel_info(LOGGER_NAMES.BOOT, 'TUI session ended, total duration: %dms', [Math.round(totalSessionTime)]);
          } catch (tuiError) {
            otel_error(LOGGER_NAMES.TUI, 'TUI error: %s', [tuiError]);
            throw tuiError;
          }
        });

      // Lazy load CLI commands for subcommands
      if (argv.length > 2 && !argv[2].startsWith('-')) {
        await withSpan(cliTracer, 'cli.boot.subcommands', async (subSpan) => {
          const subcommand = argv[2];
          subSpan.setAttribute('cli.boot.subcommand', subcommand);
          otel_info(LOGGER_NAMES.CLI, 'Loading subcommand: %s', [subcommand]);
          const { registerCli } = await import('../cli/index.js');
          await registerCli(program);
          otel_info(LOGGER_NAMES.CLI, 'Subcommands registered', []);
        });
      }

      // End boot span before command execution if not already ended (for subcommands)
      const preParseTime = performance.now();
      bootSpan.setAttribute('cli.boot.duration_ms', preParseTime - bootStartTime);
      endBootSpan();

      otel_info(LOGGER_NAMES.CLI, 'Processing CLI arguments via Commander...', []);
      // Don't wrap parseAsync in a span - for TUI it blocks for the entire session,
      // and for subcommands the individual command handlers provide their own spans
      await program.parseAsync(argv);
      otel_info(LOGGER_NAMES.CLI, 'Commander argument processing completed', []);
    } catch (error) {
      bootSpan.recordException(error as Error);
      endBootSpan();
      throw error;
    }
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
    exitCode = 1;
  } finally {
    await shutdownOTelLogging();
    await shutdownMetrics();
    await shutdownTracing();
    process.exit(exitCode);
  }
}
