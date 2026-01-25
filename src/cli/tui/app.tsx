/** @jsxImportSource @opentui/solid */
/**
 * TUI Application Entry Point
 *
 * Main entry for OpenTUI renderer with providers.
 */

import { render } from "@opentui/solid"
import { VignetteEffect, applyScanlines } from "@opentui/core"
import { ErrorBoundary } from "solid-js"
import { KVProvider } from "@tui/shared/context/kv"
import { ToastProvider } from "@tui/shared/context/toast"
import { ThemeProvider } from "@tui/shared/context/theme"
import { DialogProvider } from "@tui/shared/context/dialog"
import { SessionProvider } from "@tui/shared/context/session"
import { UpdateNotifierProvider } from "@tui/shared/context/update-notifier"
import { initTUILogger, closeTUILogger } from "@tui/shared/utils/tui-logger"
import { getSavedTheme, getTerminalBackgroundColor } from "./utils"
import { App, currentView } from "./app-shell"
import { ErrorComponent } from "./components/error-boundary"
import { appDebug } from "../../shared/logging/logger.js"
import { registerExitResolver } from "./exit"
import { getCliTracer, withSpan, withSpanSync } from "../../shared/tracing/index.js"

export type InitialToast = {
  variant: "success" | "error" | "info" | "warning"
  message: string
  duration?: number
}

/**
 * Root component with all providers
 */
function Root(props: { mode: "dark" | "light"; initialToast?: InitialToast; onExit: () => void }) {
  return (
    <ErrorBoundary fallback={(error) => <ErrorComponent error={error} onExit={props.onExit} />}>
      <KVProvider>
        <ToastProvider>
          <ThemeProvider mode={props.mode}>
            <DialogProvider>
              <SessionProvider>
                <UpdateNotifierProvider>
                  <App initialToast={props.initialToast} />
                </UpdateNotifierProvider>
              </SessionProvider>
            </DialogProvider>
          </ThemeProvider>
        </ToastProvider>
      </KVProvider>
    </ErrorBoundary>
  )
}

/**
 * Main TUI entry point
 * Detects terminal background and launches OpenTUI renderer
 */
export async function startTUI(
  skipBackgroundDetection: boolean = false,
  knownMode?: "dark" | "light",
  initialToast?: InitialToast
): Promise<void> {
  const cliTracer = getCliTracer()
  appDebug('[TUI] startTUI function entered')
  appDebug('[TUI] skipBackgroundDetection=%s, knownMode=%s', skipBackgroundDetection, knownMode)

  // Priority: 1. Saved theme from KV, 2. Known mode, 3. Auto-detect
  const mode = await withSpan(cliTracer, 'cli.tui.theme_detect', async (themeSpan) => {
    appDebug('[TUI] Getting saved theme')
    const savedTheme = await getSavedTheme()
    appDebug('[TUI] savedTheme=%s', savedTheme)
    themeSpan.setAttribute('cli.tui.theme.saved', savedTheme ?? 'none')

    appDebug('[TUI] Resolving mode')
    const resolvedMode = savedTheme
      ?? (skipBackgroundDetection && knownMode ? knownMode : null)
      ?? await getTerminalBackgroundColor()
    appDebug('[TUI] Resolved mode=%s', resolvedMode)
    themeSpan.setAttribute('cli.tui.theme.resolved', resolvedMode)
    themeSpan.setAttribute('cli.tui.theme.skip_detection', skipBackgroundDetection)
    return resolvedMode
  })

  // Wait for stdin to settle after background detection
  if (!skipBackgroundDetection) {
    appDebug('[TUI] Waiting for stdin to settle (100ms)')
    await new Promise((r) => setTimeout(r, 100))
    appDebug('[TUI] stdin settled')
  }

  // Clear terminal before OpenTUI takes over
  if (process.stdout.isTTY) {
    appDebug('[TUI] Clearing terminal')
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25h')
  }

  appDebug('[TUI] About to create render Promise')
  return new Promise<void>((resolve) => {
    appDebug('[TUI] Inside Promise, registering exit resolver')
    registerExitResolver(resolve)

    withSpanSync(cliTracer, 'cli.tui.render_init', (renderSpan) => {
      appDebug('[TUI] Inside Promise, creating VignetteEffect')
      const vignetteEffect = new VignetteEffect(0.35)
      appDebug('[TUI] VignetteEffect created, calling render()')
      renderSpan.setAttribute('cli.tui.render.target_fps', 60)
      renderSpan.setAttribute('cli.tui.render.mode', mode)

      try {
        render(
          () => {
            appDebug('[TUI] Root component render function called')
            return <Root mode={mode} initialToast={initialToast} onExit={() => {
              appDebug('[TUI] onExit called, closing TUI')
              closeTUILogger()
              if (process.stdout.isTTY) {
                process.stdout.write('\x1b[2J\x1b[H\x1b[?25h')
              }
              resolve()
            }} />
          },
          {
            targetFps: 60,
            gatherStats: false,
            exitOnCtrlC: false,
            useKittyKeyboard: { events: true },
            useMouse: true,
            postProcessFns: [
              (buffer) => {
                if (currentView === "workflow") return buffer
                return vignetteEffect.apply(buffer)
              },
              (buffer) => {
                if (currentView === "workflow") return buffer
                return applyScanlines(buffer, 0.92, 2)
              },
            ],
          }
        )
        appDebug('[TUI] render() call completed')
      } catch (renderErr) {
        appDebug('[TUI] render() error: %s', renderErr)
        throw renderErr
      }
    })

    appDebug('[TUI] Setting up TUI logger timeout (200ms)')
    setTimeout(() => {
      appDebug('[TUI] Initializing TUI logger')
      initTUILogger()
    }, 200)
  })
}
