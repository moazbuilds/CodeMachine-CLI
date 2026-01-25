/**
 * Narrator TUI Launcher
 *
 * Minimal TUI shell for the narrator feature.
 * Only includes ThemeProvider - no workflow providers needed.
 *
 * Architecture:
 * - Dev mode: Preload registers transform plugin for runtime compilation
 * - Compiled binaries: JSX already transformed at build time, preload not needed
 */

import { appDebug } from '../../shared/logging/logger.js'
import type { NarratorScript } from './routes/narrator/parser/types.js'

// Only load preload in dev mode (when running from source)
const isDev = import.meta.url.includes('/src/')
appDebug('[NarratorLauncher] isDev=%s', isDev)
if (isDev) {
  appDebug('[NarratorLauncher] Loading OpenTUI preload')
  await import('@opentui/solid/preload')
  appDebug('[NarratorLauncher] OpenTUI preload loaded')
}

export interface NarratorLaunchOptions {
  /** Script to narrate */
  script: NarratorScript
  /** Typing speed in ms per character (default: 30) */
  speed?: number
}

/**
 * Launch the narrator TUI
 */
export async function startNarratorTUI(options: NarratorLaunchOptions): Promise<void> {
  appDebug('[NarratorLauncher] startNarratorTUI() called')
  appDebug('[NarratorLauncher] Importing narrator app module')

  try {
    const app = await import('./narrator-app.js')
    appDebug('[NarratorLauncher] narrator-app.js imported successfully')
    appDebug('[NarratorLauncher] Calling app.startNarratorTUI()')
    const result = await app.startNarratorTUI(options)
    appDebug('[NarratorLauncher] app.startNarratorTUI() returned')
    return result
  } catch (err) {
    appDebug('[NarratorLauncher] Error: %s', err)
    throw err
  }
}
