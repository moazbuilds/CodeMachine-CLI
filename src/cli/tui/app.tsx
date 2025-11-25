/** @jsxImportSource @opentui/solid */
import { render, useTerminalDimensions, useKeyboard, useRenderer } from "@opentui/solid"
import { VignetteEffect, applyScanlines, TextAttributes } from "@opentui/core"
import { ErrorBoundary, Match, Show, Switch, createSignal } from "solid-js"
import { KVProvider, useKV } from "@tui/context/kv"
import { ToastProvider, useToast } from "@tui/context/toast"
import { ThemeProvider, useTheme } from "@tui/context/theme"
import { DialogProvider } from "@tui/context/dialog"
import { SessionProvider, useSession } from "@tui/context/session"
import { UpdateNotifierProvider, useUpdateNotifier } from "@tui/context/update-notifier"
import { Home } from "@tui/routes/home"
import { Workflow } from "@tui/routes/workflow"
import { homedir } from "os"
import { WorkflowEventBus } from "../../workflows/events/index.js"
import path from "path"
import { createRequire } from "node:module"
import { resolvePackageJson } from "../../shared/runtime/pkg.js"
import { initTUILogger, closeTUILogger } from "@tui/utils/tui-logger"

/**
 * Detects terminal background color by querying with OSC 11 escape sequence
 * Returns "dark" or "light" based on luminance calculation
 */
async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
  // Can't set raw mode if not a TTY
  if (!process.stdin.isTTY) return "dark"

  return new Promise((resolve) => {
    const timeout: NodeJS.Timeout = setTimeout(() => {
      cleanup()
      resolve("dark") // Default to dark if no response
    }, 1000)

    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.removeListener("data", handler)
      clearTimeout(timeout)
      // Pause stdin to drain any buffered input before OpenTUI takes over
      process.stdin.pause()
    }

    const handler = (data: Buffer) => {
      const str = data.toString()
      // eslint-disable-next-line no-control-regex
      const match = str.match(/\x1b]11;([^\x07\x1b]+)/)
      if (match) {
        cleanup()
        const color = match[1]
        // Parse RGB values from color string
        // Formats: rgb:RR/GG/BB or #RRGGBB or rgb(R,G,B)
        let r = 0,
          g = 0,
          b = 0

        if (color.startsWith("rgb:")) {
          const parts = color.substring(4).split("/")
          r = parseInt(parts[0], 16) >> 8 // Convert 16-bit to 8-bit
          g = parseInt(parts[1], 16) >> 8
          b = parseInt(parts[2], 16) >> 8
        } else if (color.startsWith("#")) {
          r = parseInt(color.substring(1, 3), 16)
          g = parseInt(color.substring(3, 5), 16)
          b = parseInt(color.substring(5, 7), 16)
        } else if (color.startsWith("rgb(")) {
          const parts = color.substring(4, color.length - 1).split(",")
          r = parseInt(parts[0])
          g = parseInt(parts[1])
          b = parseInt(parts[2])
        }

        // Calculate luminance using relative luminance formula
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

        // Determine if dark or light based on luminance threshold
        resolve(luminance > 0.5 ? "light" : "dark")
      }
    }

    process.stdin.setRawMode(true)
    process.stdin.on("data", handler)
    process.stdout.write("\x1b]11;?\x07")
  })
}

export type InitialToast = {
  variant: "success" | "error" | "info" | "warning"
  message: string
  duration?: number
}

/**
 * Main TUI entry point
 * Detects terminal background and launches OpenTUI renderer
 */
/**
 * Read saved theme from KV file (if exists)
 */
async function getSavedTheme(): Promise<"dark" | "light" | null> {
  try {
    const kvPath = path.join(homedir(), ".codemachine", "state", "kv.json")
    const file = Bun.file(kvPath)
    const data = await file.json() as { theme?: string }
    if (data.theme === "dark" || data.theme === "light") {
      return data.theme
    }
  } catch {
    // File doesn't exist or invalid
  }
  return null
}

export async function startTUI(
  skipBackgroundDetection: boolean = false,
  knownMode?: "dark" | "light",
  initialToast?: InitialToast
): Promise<void> {
  // Priority: 1. Saved theme from KV, 2. Known mode, 3. Auto-detect
  const savedTheme = await getSavedTheme()
  const mode = savedTheme
    ?? (skipBackgroundDetection && knownMode ? knownMode : null)
    ?? await getTerminalBackgroundColor()

  // Wait for stdin to settle after background detection
  // This prevents focus/mouse events from leaking through before OpenTUI's filters are active
  if (!skipBackgroundDetection) {
    await new Promise((r) => setTimeout(r, 100))
  }

  // Clear terminal before OpenTUI takes over (removes splash)
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25h') // Clear screen, home cursor, show cursor
  }

  return new Promise<void>((resolve) => {
    // Create vignette effect with refined, subtle strength
    const vignetteEffect = new VignetteEffect(0.35)

    render(
      () => <Root mode={mode} initialToast={initialToast} onExit={() => {
        closeTUILogger()

        // Clean terminal completely before exit
        if (process.stdout.isTTY) {
          process.stdout.write('\x1b[2J\x1b[H\x1b[?25h') // Clear screen, home cursor, show cursor
        }

        resolve()
      }} />,
      {
        targetFps: 60,
        gatherStats: false,
        exitOnCtrlC: false,
        useKittyKeyboard: true,
        useMouse: false, // Disable mouse tracking to prevent escape sequences
        postProcessFns: [
          // Apply vignette for professional focus on center
          (buffer) => vignetteEffect.apply(buffer),
          // Apply subtle scanlines for refined CRT aesthetic
          (buffer) => applyScanlines(buffer, 0.92, 2), // Very subtle (8% darkening) every 2nd line
        ],
      }
    )

    // Initialize logger AFTER render starts (OpenTUI console capture is now active)
    setTimeout(() => {
      initTUILogger()
    }, 200)
  })
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
 * Main App component - wraps Home with full-screen background and footer
 */
function App(props: { initialToast?: InitialToast }) {
  const dimensions = useTerminalDimensions()
  const themeCtx = useTheme()
  const session = useSession()
  const updateNotifier = useUpdateNotifier()
  const renderer = useRenderer()
  const toast = useToast()
  const kv = useKV()

  // Track Ctrl+C presses for confirmation using signals
  const [ctrlCPressed, setCtrlCPressed] = createSignal(false)
  let ctrlCTimeout: NodeJS.Timeout | null = null
  const [view, setView] = createSignal<"home" | "workflow">("home")
  const [workflowEventBus, setWorkflowEventBus] = createSignal<WorkflowEventBus | null>(null)

  // Store workflow start function to be called when adapter is ready
  let pendingWorkflowStart: (() => void) | null = null

  // Called by Workflow component when adapter is connected and ready
  const handleAdapterReady = () => {
    if (pendingWorkflowStart) {
      pendingWorkflowStart()
      pendingWorkflowStart = null
    }
  }

  // Start workflow execution when switching to workflow view
  const handleStartWorkflow = async () => {
    // Create event bus for this workflow run
    const eventBus = new WorkflowEventBus()
    setWorkflowEventBus(eventBus)

    // Export to global for backward compatibility
    // @ts-expect-error - global export for workflow connection
    globalThis.__workflowEventBus = eventBus

    // Prepare the workflow start function (will be called when adapter is ready)
    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    const specPath = path.join(cwd, '.codemachine', 'inputs', 'specifications.md')

    pendingWorkflowStart = () => {
      // Dynamically import to avoid circular dependencies
      import("../../workflows/execution/queue.js").then(({ runWorkflowQueue }) => {
        runWorkflowQueue({ cwd, specificationPath: specPath }).catch((error) => {
          console.error("Workflow failed:", error)
        })
      })
    }

    // Switch to workflow view - adapter will signal when ready via handleAdapterReady
    setView("workflow")
  }

  // Global keyboard handler
  useKeyboard((evt) => {
    // Hidden theme toggle: Ctrl+T (Shift+T would be intercepted by terminal)
    if (evt.ctrl && evt.name.toLowerCase() === "t") {
      evt.preventDefault()
      const newMode = themeCtx.mode === "dark" ? "light" : "dark"
      themeCtx.setMode(newMode)
      kv.set("theme", newMode)
      toast.show({
        variant: "info",
        message: `Theme: ${newMode}`,
        duration: 2000,
      })
      return
    }

    // Ctrl+C handler with confirmation
    if (evt.ctrl && evt.name === "c") {
      evt.preventDefault()

      if (ctrlCPressed()) {
        // Second Ctrl+C within timeout - actually exit
        if (ctrlCTimeout) clearTimeout(ctrlCTimeout)

        renderer.destroy()

        // Clean terminal completely before exit
        if (process.stdout.isTTY) {
          process.stdout.write('\x1b[2J\x1b[H\x1b[?25h') // Clear screen, home cursor, show cursor
        }

        process.exit(0)
      } else {
        // First Ctrl+C - show warning toast
        setCtrlCPressed(true)
        toast.show({
          variant: "warning",
          message: "Press Ctrl+C again to exit",
          duration: 3000,
        })

        // Reset after 3 seconds
        ctrlCTimeout = setTimeout(() => {
          setCtrlCPressed(false)
          ctrlCTimeout = null
        }, 3000)
      }
    }
  })

  // Get version from package.json
  const getVersion = () => {
    const require = createRequire(import.meta.url)
    const packageJsonPath = resolvePackageJson(import.meta.url, "app component")
    const pkg = require(packageJsonPath) as { version: string }
    return pkg.version
  }

  // CWD with home directory replacement
  const cwd = () => {
    const home = homedir()
    return process.cwd().replace(home, "~")
  }

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={themeCtx.theme.background}
      flexDirection="column"
    >
      {/* Main content area */}
      <box flexGrow={1}>
        <Switch>
          <Match when={view() === "home"}>
            <Home
              initialToast={props.initialToast}
              onStartWorkflow={handleStartWorkflow}
            />
          </Match>
          <Match when={view() === "workflow"}>
            <Workflow eventBus={workflowEventBus()} onAdapterReady={handleAdapterReady} />
          </Match>
        </Switch>
      </box>

      {/* Footer - fixed height */}
      <box height={1} flexShrink={0} backgroundColor={themeCtx.theme.backgroundPanel}>
        <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
          {/* Left: Branding + Version + Update + CWD */}
          <box flexDirection="row" gap={1}>
            <box paddingLeft={1} paddingRight={1} backgroundColor={themeCtx.theme.backgroundElement}>
              <text fg={themeCtx.theme.text}>
                Code<span style={{ bold: true }}>Machine</span>
              </text>
            </box>
            <text fg={themeCtx.theme.textMuted}>v{getVersion()}</text>
            <Show when={updateNotifier.updateAvailable}>
              <text fg={themeCtx.theme.warning}>• Update: v{String(updateNotifier.latestVersion)}</text>
            </Show>
            <text fg={themeCtx.theme.textMuted}>{cwd()}</text>
          </box>

          {/* Right: Template badge */}
          <box flexDirection="row">
            <text fg={themeCtx.theme.textMuted}>Template: </text>
            <text fg={themeCtx.theme.primary} attributes={TextAttributes.BOLD}>{String(session.templateName).toUpperCase()}</text>
          </box>
        </box>
      </box>
    </box>
  )
}

/**
 * Error boundary fallback component
 */
function ErrorComponent(props: { error: Error; onExit: () => void }) {
  const term = useTerminalDimensions()
  const [copied, setCopied] = createSignal(false)

  const copyError = () => {
    const errorText = `CodeMachine Error:\n\n${props.error.stack || props.error.message}`
    // Use Bun's clipboard if available, otherwise just set copied state
    try {
      if (typeof navigator !== "undefined" && "clipboard" in navigator) {
        navigator.clipboard.writeText(errorText).then(() => setCopied(true))
      } else {
        setCopied(true)
      }
    } catch {
      setCopied(true)
    }
  }

  const handleExit = () => {
    // Clean terminal before exit
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[2J\x1b[H\x1b[?25h')
    }
    props.onExit()
  }

  return (
    <box flexDirection="column" gap={1} padding={2}>
      <box flexDirection="row" gap={2} alignItems="center">
        <text attributes={1}>Fatal Error Occurred</text>
        <box onMouseUp={copyError} backgroundColor="#565f89" padding={1}>
          <text attributes={1}>Copy Error</text>
        </box>
        {copied() && <text>✓ Copied</text>}
      </box>
      <box flexDirection="row" gap={2}>
        <text>Press Ctrl+C to exit</text>
        <box onMouseUp={handleExit} backgroundColor="#565f89" padding={1}>
          <text>Exit Now</text>
        </box>
      </box>
      <box height={1} />
      <scrollbox height={Math.floor(term().height * 0.7)}>
        <text>{props.error.stack || props.error.message}</text>
      </scrollbox>
    </box>
  )
}
