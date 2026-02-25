/**
 * TUI Runtime Launcher
 *
 * This module loads the OpenTUI SolidJS transform ONLY for TUI components,
 * preventing the global Babel transform from affecting React/Ink UI files.
 *
 * The preload registers a Bun plugin that transforms JSX in files imported
 * AFTER this module. Since React/Ink workflow UI is loaded in a separate
 * import chain (via lazy import in routes/home.tsx), it remains unaffected.
 *
 * Architecture:
 * - Dev mode: Preload registers transform plugin for runtime compilation
 * - Compiled binaries: JSX already transformed at build time, preload not needed
 *
 * IMPORTANT: We must import preload first, THEN dynamically import app.js
 * to ensure the plugin is registered before any JSX files are parsed.
 */

import { otel_debug } from '../../shared/logging/logger.js';
import { LOGGER_NAMES } from '../../shared/logging/otel-logger.js';

// Only load preload in dev mode (when running from source)
// In production binaries, JSX is pre-transformed during build
const isDev = import.meta.url.includes('/src/')
otel_debug(LOGGER_NAMES.TUI, '[Launcher] isDev=%s', [isDev]);
if (isDev) {
  otel_debug(LOGGER_NAMES.TUI, '[Launcher] Loading OpenTUI preload', []);
  await import("@opentui/solid/preload")
  otel_debug(LOGGER_NAMES.TUI, '[Launcher] OpenTUI preload loaded', []);
}

// Dynamic import ensures app.js is loaded AFTER preload is registered (in dev)
export async function startTUI() {
  otel_debug(LOGGER_NAMES.TUI, '[Launcher] startTUI() called', []);
  otel_debug(LOGGER_NAMES.TUI, '[Launcher] Importing TUI app module', []);
  try {
    const app = await import("./app.js");
    otel_debug(LOGGER_NAMES.TUI, '[Launcher] app.js imported successfully', []);
    otel_debug(LOGGER_NAMES.TUI, '[Launcher] Calling app.startTUI()', []);
    const result = await app.startTUI();
    otel_debug(LOGGER_NAMES.TUI, '[Launcher] app.startTUI() returned', []);
    return result;
  } catch (err) {
    otel_debug(LOGGER_NAMES.TUI, '[Launcher] Error: %s', [err]);
    throw err;
  }
}
