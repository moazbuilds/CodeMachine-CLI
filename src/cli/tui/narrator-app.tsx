/** @jsxImportSource @opentui/solid */
/**
 * Narrator TUI Application
 *
 * Clean, minimal TUI app for the narrator feature.
 * No vignette or scanlines - just clean visuals.
 */

import { render } from '@opentui/solid'
import { ErrorBoundary } from 'solid-js'
import { ThemeProvider, useTheme } from '@tui/shared/context/theme'
import { NarratorView } from './routes/narrator/index.js'
import { appDebug } from '../../shared/logging/logger.js'
import type { NarratorScript } from './routes/narrator/parser/types.js'

export interface NarratorAppOptions {
  /** Script to narrate */
  script: NarratorScript
  /** Typing speed in ms per character */
  speed?: number
}

/**
 * Error fallback component
 */
function ErrorFallback(props: { error: Error; onExit: () => void }) {
  return (
    <box flexDirection="column" padding={2}>
      <text fg="#ff0000">Error: {props.error.message}</text>
      <text fg="#888888">Press Ctrl+C to exit</text>
    </box>
  )
}

/**
 * Inner component that uses theme
 */
function NarratorInner(props: {
  script: NarratorScript
  speed?: number
  onExit: () => void
}) {
  const themeCtx = useTheme()

  return (
    <box backgroundColor={themeCtx.theme.background} width="100%" height="100%">
      <NarratorView script={props.script} speed={props.speed} onExit={props.onExit} />
    </box>
  )
}

/**
 * Root component with minimal providers
 */
function NarratorRoot(props: {
  script: NarratorScript
  speed?: number
  onExit: () => void
}) {
  return (
    <ErrorBoundary fallback={(error) => <ErrorFallback error={error} onExit={props.onExit} />}>
      <ThemeProvider mode="dark">
        <NarratorInner script={props.script} speed={props.speed} onExit={props.onExit} />
      </ThemeProvider>
    </ErrorBoundary>
  )
}

/**
 * Start the narrator TUI
 */
export async function startNarratorTUI(options: NarratorAppOptions): Promise<void> {
  appDebug('[NarratorApp] startNarratorTUI function entered')

  // Clear terminal before taking over
  if (process.stdout.isTTY) {
    appDebug('[NarratorApp] Clearing terminal')
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25l') // Clear and hide cursor
  }

  return new Promise<void>((resolve) => {
    appDebug('[NarratorApp] Creating render')

    render(
      () => {
        appDebug('[NarratorApp] NarratorRoot render function called')
        return (
          <NarratorRoot
            script={options.script}
            speed={options.speed}
            onExit={() => {
              appDebug('[NarratorApp] onExit called')
              // Show cursor and clear
              if (process.stdout.isTTY) {
                process.stdout.write('\x1b[2J\x1b[H\x1b[?25h')
              }
              resolve()
            }}
          />
        )
      },
      {
        targetFps: 60,
        gatherStats: false,
        exitOnCtrlC: false,
        useKittyKeyboard: { events: true },
        useMouse: false,
        // No post-processing effects - clean background
      }
    )

    appDebug('[NarratorApp] render() call completed')
  })
}
