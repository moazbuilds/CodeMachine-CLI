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
import { otel_debug } from "../../shared/logging/logger.js"
import { LOGGER_NAMES } from "../../shared/logging/otel-logger.js"
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
  otel_debug(LOGGER_NAMES.TUI, '[TUI] startTUI function entered', [])
  otel_debug(LOGGER_NAMES.TUI, '[TUI] skipBackgroundDetection=%s, knownMode=%s', [skipBackgroundDetection, knownMode])

  // Priority: 1. Saved theme from KV, 2. Known mode, 3. Auto-detect
  const mode = await withSpan(cliTracer, 'cli.tui.theme_detect', async (themeSpan) => {
    otel_debug(LOGGER_NAMES.TUI, '[TUI] Getting saved theme', [])
    const savedTheme = await getSavedTheme()
    otel_debug(LOGGER_NAMES.TUI, '[TUI] savedTheme=%s', [savedTheme])
    themeSpan.setAttribute('cli.tui.theme.saved', savedTheme ?? 'none')

    otel_debug(LOGGER_NAMES.TUI, '[TUI] Resolving mode', [])
    const resolvedMode = savedTheme
      ?? (skipBackgroundDetection && knownMode ? knownMode : null)
      ?? await getTerminalBackgroundColor()
    otel_debug(LOGGER_NAMES.TUI, '[TUI] Resolved mode=%s', [resolvedMode])
    themeSpan.setAttribute('cli.tui.theme.resolved', resolvedMode)
    themeSpan.setAttribute('cli.tui.theme.skip_detection', skipBackgroundDetection)
    return resolvedMode
  })

  // Wait for stdin to settle after background detection
  if (!skipBackgroundDetection) {
    otel_debug(LOGGER_NAMES.TUI, '[TUI] Waiting for stdin to settle (100ms)', [])
    await new Promise((r) => setTimeout(r, 100))
    otel_debug(LOGGER_NAMES.TUI, '[TUI] stdin settled', [])
  }

  // Clear terminal before OpenTUI takes over
  if (process.stdout.isTTY) {
    otel_debug(LOGGER_NAMES.TUI, '[TUI] Clearing terminal', [])
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25h')
  }

  otel_debug(LOGGER_NAMES.TUI, '[TUI] About to create render Promise', [])
  return new Promise<void>((resolve) => {
    otel_debug(LOGGER_NAMES.TUI, '[TUI] Inside Promise, registering exit resolver', [])
    registerExitResolver(resolve)

    withSpanSync(cliTracer, 'cli.tui.render_init', (renderSpan) => {
      otel_debug(LOGGER_NAMES.TUI, '[TUI] Inside Promise, creating VignetteEffect', [])
      const vignetteEffect = new VignetteEffect(0.35)
      otel_debug(LOGGER_NAMES.TUI, '[TUI] VignetteEffect created, calling render()', [])
      renderSpan.setAttribute('cli.tui.render.target_fps', 60)
      renderSpan.setAttribute('cli.tui.render.mode', mode)

      try {
        render(
          () => {
            otel_debug(LOGGER_NAMES.TUI, '[TUI] Root component render function called', [])
            return <Root mode={mode} initialToast={initialToast} onExit={() => {
              otel_debug(LOGGER_NAMES.TUI, '[TUI] onExit called, closing TUI', [])
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
        otel_debug(LOGGER_NAMES.TUI, '[TUI] render() call completed', [])
      } catch (renderErr) {
        otel_debug(LOGGER_NAMES.TUI, '[TUI] render() error: %s', [renderErr])
        throw renderErr
      }
    })

    otel_debug(LOGGER_NAMES.TUI, '[TUI] Setting up TUI logger timeout (200ms)', [])
    setTimeout(() => {
      otel_debug(LOGGER_NAMES.TUI, '[TUI] Initializing TUI logger', [])
      initTUILogger()
    }, 200)
  })
}
