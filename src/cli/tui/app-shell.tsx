/** @jsxImportSource @opentui/solid */
/**
 * App Shell Component
 *
 * Main application with routing and layout.
 */

import { Match, Show, Switch, createSignal, createEffect } from "solid-js"
import { useTerminalDimensions, useKeyboard, useRenderer } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { useKV } from "@tui/shared/context/kv"
import { useToast } from "@tui/shared/context/toast"
import { Toast } from "@tui/shared/ui/toast"
import { useTheme } from "@tui/shared/context/theme"
import { useSession } from "@tui/shared/context/session"
import { useUpdateNotifier } from "@tui/shared/context/update-notifier"
import { Home } from "@tui/routes/home"
import { Workflow } from "@tui/routes/workflow"
import { Onboard } from "@tui/routes/onboard"
import { homedir } from "os"
import { WorkflowEventBus, OnboardingService } from "../../workflows/events/index.js"
import { debug, setDebugLogFile, appDebug } from "../../shared/logging/logger.js"
import { MonitoringCleanup } from "../../agents/monitoring/index.js"
import path from "path"
import { VERSION } from "../../runtime/version.js"
import { setSelectedTrack, setSelectedConditions, setProjectName } from "../../shared/workflows/index.js"
import { checkOnboardingRequired, needsOnboarding } from "../../workflows/preflight.js"
import type { TracksConfig, ConditionGroup } from "../../workflows/templates/types"
import type { InitialToast } from "./app"

// Module-level view state for post-processing effects
export let currentView: "home" | "onboard" | "workflow" = "home"

/**
 * Get the clipboard copy method based on OS (lazy loaded)
 */
function getClipboardCopyMethod(): ((text: string) => Promise<void>) | null {
  const os = process.platform

  if (os === "darwin" && Bun.which("osascript")) {
    return async (text: string) => {
      const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      await Bun.$`osascript -e 'set the clipboard to "${escaped}"'`.nothrow().quiet()
    }
  }

  if (os === "linux") {
    if (process.env.WAYLAND_DISPLAY && Bun.which("wl-copy")) {
      return async (text: string) => {
        const proc = Bun.spawn(["wl-copy"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited.catch(() => {})
      }
    }
    if (Bun.which("xclip")) {
      return async (text: string) => {
        const proc = Bun.spawn(["xclip", "-selection", "clipboard"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited.catch(() => {})
      }
    }
    if (Bun.which("xsel")) {
      return async (text: string) => {
        const proc = Bun.spawn(["xsel", "--clipboard", "--input"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited.catch(() => {})
      }
    }
    if (Bun.which("clip.exe")) {
      return async (text: string) => {
        const proc = Bun.spawn(["clip.exe"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited.catch(() => {})
      }
    }
  }

  if (os === "win32" && Bun.which("powershell")) {
    return async (text: string) => {
      const escaped = text.replace(/"/g, '""')
      await Bun.$`powershell -command "Set-Clipboard -Value \"${escaped}\""`.nothrow().quiet()
    }
  }

  return null
}

let clipboardMethod: ((text: string) => Promise<void>) | null | undefined

async function copyToSystemClipboard(text: string): Promise<void> {
  if (clipboardMethod === undefined) {
    clipboardMethod = getClipboardCopyMethod()
  }
  if (clipboardMethod) {
    await clipboardMethod(text)
  }
}

export function App(props: { initialToast?: InitialToast }) {
  appDebug('[AppShell] App component initializing')
  const dimensions = useTerminalDimensions()
  const themeCtx = useTheme()
  const session = useSession()
  const updateNotifier = useUpdateNotifier()
  const renderer = useRenderer()
  const toast = useToast()
  const kv = useKV()
  appDebug('[AppShell] Hooks initialized')

  // Global error handler - any part of the app can emit 'app:error' to show a toast
  const handleAppError = (data: { message: string; duration?: number }) => {
    appDebug('[AppShell] App error received: %s', data.message)
    toast.show({
      variant: "error",
      message: data.message,
      duration: data.duration ?? 0, // permanent by default
    })
  }
  ;(process as NodeJS.EventEmitter).on('app:error', handleAppError)

  // Return to home handler - triggered when user confirms exit from workflow
  const handleReturnHome = () => {
    currentView = "home"
    setView("home")
  }
  ;(process as NodeJS.EventEmitter).on('workflow:return-home', handleReturnHome)

  const [ctrlCPressed, setCtrlCPressed] = createSignal(false)
  let ctrlCTimeout: NodeJS.Timeout | null = null
  const [view, setView] = createSignal<"home" | "onboard" | "workflow">("home")
  const [workflowEventBus, setWorkflowEventBus] = createSignal<WorkflowEventBus | null>(null)
  const [templateTracks, setTemplateTracks] = createSignal<TracksConfig | null>(null)
  const [templateConditionGroups, setTemplateConditionGroups] = createSignal<ConditionGroup[] | null>(null)
  const [initialProjectName, setInitialProjectName] = createSignal<string | null>(null)
  const [onboardingService, setOnboardingService] = createSignal<OnboardingService | null>(null)
  const [onboardingEventBus, setOnboardingEventBus] = createSignal<WorkflowEventBus | null>(null)

  let pendingWorkflowStart: (() => void) | null = null

  const handleAdapterReady = () => {
    if (pendingWorkflowStart) {
      pendingWorkflowStart()
      pendingWorkflowStart = null
    }
  }

  const handleStartWorkflow = async () => {
    appDebug('[AppShell] handleStartWorkflow called')
    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    const cmRoot = path.join(cwd, '.codemachine')
    appDebug('[AppShell] cwd=%s, cmRoot=%s', cwd, cmRoot)

    // Initialize debug log file early (before onboarding) so all logs are captured
    const rawLogLevel = (process.env.LOG_LEVEL || '').trim().toLowerCase()
    const debugFlag = (process.env.DEBUG || '').trim().toLowerCase()
    const debugEnabled = rawLogLevel === 'debug' || (debugFlag !== '' && debugFlag !== '0' && debugFlag !== 'false')
    if (debugEnabled) {
      const debugLogPath = path.join(cwd, '.codemachine', 'logs', 'workflow-debug.log')
      appDebug('[AppShell] Switching to workflow debug log: %s', debugLogPath)
      setDebugLogFile(debugLogPath)
    }

    // Run pre-flight checks
    try {
      const onboardingNeeds = await checkOnboardingRequired({ cwd })
      const { template } = onboardingNeeds

      // If any onboarding is needed, show onboard view
      if (needsOnboarding(onboardingNeeds)) {
        debug('[AppShell] Starting onboarding flow')

        const hasTracks = template.tracks && Object.keys(template.tracks.options).length > 0
        const hasConditionGroups = template.conditionGroups && template.conditionGroups.length > 0

        // Store config for Onboard component
        if (hasTracks) setTemplateTracks(template.tracks!)
        if (hasConditionGroups) setTemplateConditionGroups(template.conditionGroups!)
        setInitialProjectName(null)

        // Create event bus and service for onboarding
        const eventBus = new WorkflowEventBus()
        setOnboardingEventBus(eventBus)

        const service = new OnboardingService(eventBus, {
          tracks: hasTracks ? template.tracks : undefined,
          conditionGroups: hasConditionGroups ? template.conditionGroups : undefined,
          initialProjectName: onboardingNeeds.needsProjectName ? undefined : undefined,
        })
        setOnboardingService(service)

        // Subscribe to completion event
        eventBus.on('onboard:completed', (event) => {
          debug('[AppShell] onboard:completed received result=%o', event.result)
          handleOnboardComplete(event.result)
        })

        // Subscribe to cancel event
        eventBus.on('onboard:cancelled', () => {
          debug('[AppShell] onboard:cancelled received')
          handleOnboardCancel()
        })

        currentView = "onboard"
        setView("onboard")
        return
      }
    } catch (error) {
      // If pre-flight check fails, proceed to workflow anyway
      appDebug('[AppShell] Failed pre-flight check: %s', error)
      console.error("Failed pre-flight check:", error)
    }

    // No onboarding needed - start workflow directly
    appDebug('[AppShell] Starting workflow execution directly')
    startWorkflowExecution()
  }

  const startWorkflowExecution = () => {
    appDebug('[AppShell] startWorkflowExecution called')
    const eventBus = new WorkflowEventBus()
    setWorkflowEventBus(eventBus)
    // @ts-expect-error - global export for workflow connection
    globalThis.__workflowEventBus = eventBus

    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    const specPath = path.join(cwd, '.codemachine', 'inputs', 'specifications.md')
    appDebug('[AppShell] specPath=%s', specPath)

    pendingWorkflowStart = () => {
      appDebug('[AppShell] Importing and running workflow')
      import("../../workflows/run.js").then(({ runWorkflow }) => {
        runWorkflow({ cwd }).catch((error) => {
          // Error is already handled by workflow:error event (shows ErrorModal)
          // Just log it here for debugging - no need to show toast
          const errorMsg = error instanceof Error ? error.message : String(error)
          appDebug('[AppShell] Workflow error (handled by ErrorModal): %s', errorMsg.slice(0, 200))
        })
      })
    }

    currentView = "workflow"
    setView("workflow")
    appDebug('[AppShell] View set to workflow')
  }

  const handleOnboardComplete = async (result: { projectName?: string; trackId?: string; conditions?: string[] }) => {
    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    const cmRoot = path.join(cwd, '.codemachine')

    // Save project name if provided
    if (result.projectName) {
      await setProjectName(cmRoot, result.projectName)
    }

    // Save selected track if provided
    if (result.trackId) {
      await setSelectedTrack(cmRoot, result.trackId)
    }

    // Always save selected conditions (even if empty array)
    if (result.conditions !== undefined) {
      await setSelectedConditions(cmRoot, result.conditions)
    }

    // Start workflow
    startWorkflowExecution()
  }

  const handleOnboardCancel = () => {
    currentView = "home"
    setView("home")
  }

  createEffect(() => {
    if (view() === "workflow") {
      MonitoringCleanup.registerWorkflowHandlers({
        onStop: () => {
          ;(process as NodeJS.EventEmitter).emit('workflow:stopping')
        },
        onExit: () => {
          renderer.destroy()
        },
      })
    }
  })

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name.toLowerCase() === "t") {
      evt.preventDefault()
      const newMode = themeCtx.mode === "dark" ? "light" : "dark"
      themeCtx.setMode(newMode)
      kv.set("theme", newMode)
      toast.show({ variant: "info", message: `Theme: ${newMode}`, duration: 2000 })
      return
    }

    if (evt.ctrl && evt.name === "c") {
      evt.preventDefault()

      // Check if there's a text selection - if so, copy it instead of exiting
      const selection = renderer.getSelection()
      if (selection && selection.isActive) {
        const selectedText = selection.getSelectedText()
        if (selectedText && selectedText.length > 0) {
          // OSC52 via renderer.writeOut
          const base64 = Buffer.from(selectedText).toString("base64")
          const osc52 = `\x1b]52;c;${base64}\x07`
          const finalOsc52 = process.env.TMUX ? `\x1bPtmux;\x1b${osc52}\x1b\\` : osc52
          // @ts-expect-error writeOut exists on renderer
          renderer.writeOut(finalOsc52)
          // Also try system clipboard
          copyToSystemClipboard(selectedText)
            .then(() => toast.show({ variant: "info", message: "Copied to clipboard", duration: 1500 }))
            .catch(() => toast.show({ variant: "error", message: "Failed to copy", duration: 1500 }))
          renderer.clearSelection()
          return
        }
      }

      if (view() === "workflow") {
        void MonitoringCleanup.triggerCtrlCFromUI()
        return
      }
      if (ctrlCPressed()) {
        if (ctrlCTimeout) clearTimeout(ctrlCTimeout)
        renderer.destroy()
        if (process.stdout.isTTY) {
          process.stdout.write('\x1b[2J\x1b[H\x1b[?25h')
        }
        process.exit(0)
      } else {
        setCtrlCPressed(true)
        toast.show({ variant: "warning", message: "Press Ctrl+C again to exit", duration: 3000 })
        ctrlCTimeout = setTimeout(() => {
          setCtrlCPressed(false)
          ctrlCTimeout = null
        }, 3000)
      }
    }
  })

  const getVersion = () => {
    return VERSION
  }

  const cwd = () => {
    const home = homedir()
    return process.cwd().replace(home, "~")
  }

  return (
    <box width={dimensions().width} height={dimensions().height} backgroundColor={themeCtx.theme.background} flexDirection="column">
      <Toast />
      <box flexGrow={1}>
        <Switch>
          <Match when={view() === "home"}>
            <Home initialToast={props.initialToast} onStartWorkflow={handleStartWorkflow} />
          </Match>
          <Match when={view() === "onboard"}>
            <Onboard
              tracks={templateTracks() ?? undefined}
              conditionGroups={templateConditionGroups() ?? undefined}
              initialProjectName={initialProjectName()}
              onComplete={handleOnboardComplete}
              onCancel={handleOnboardCancel}
              eventBus={onboardingEventBus() ?? undefined}
              service={onboardingService() ?? undefined}
            />
          </Match>
          <Match when={view() === "workflow"}>
            <Workflow eventBus={workflowEventBus()} onAdapterReady={handleAdapterReady} />
          </Match>
        </Switch>
      </box>

      <Show when={view() === "home"}>
        <box height={1} flexShrink={0} backgroundColor={themeCtx.theme.backgroundPanel}>
          <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
            <box flexDirection="row" gap={1}>
              <box paddingLeft={1} paddingRight={1} backgroundColor={themeCtx.theme.backgroundElement}>
                <text fg={themeCtx.theme.text}>Code<span style={{ bold: true }}>Machine</span></text>
              </box>
              <text fg={themeCtx.theme.textMuted}>v{getVersion()}</text>
              <Show when={updateNotifier.updateAvailable}>
                <text fg={themeCtx.theme.warning}>Update: v{String(updateNotifier.latestVersion)}</text>
              </Show>
              <text fg={themeCtx.theme.textMuted}>{cwd()}</text>
            </box>
            <box flexDirection="row">
              <text fg={themeCtx.theme.textMuted}>Template: </text>
              <Show when={session.templateName} fallback={
                <text fg={themeCtx.theme.textMuted}>No Templates</text>
              }>
                <text fg={themeCtx.theme.primary} attributes={TextAttributes.BOLD}>
                  {String(session.templateName).toUpperCase()}
                </text>
              </Show>
            </box>
          </box>
        </box>
      </Show>
    </box>
  )
}
