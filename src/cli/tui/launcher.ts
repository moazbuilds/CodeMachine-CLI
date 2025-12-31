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

import { appDebug } from '../../shared/logging/logger.js';

// Only load preload in dev mode (when running from source)
// In production binaries, JSX is pre-transformed during build
const isDev = import.meta.url.includes('/src/')
appDebug('[Launcher] isDev=%s', isDev);
if (isDev) {
  appDebug('[Launcher] Loading OpenTUI preload');
  await import("@opentui/solid/preload")
}

// Dynamic import ensures app.js is loaded AFTER preload is registered (in dev)
export async function startTUI() {
  appDebug('[Launcher] Importing TUI app module');
  const app = await import("./app.js");
  appDebug('[Launcher] Starting TUI app');
  return app.startTUI();
}
