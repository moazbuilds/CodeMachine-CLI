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
import { WorkflowEventBus } from "../../workflows/events/index.js"
import { MonitoringCleanup } from "../../agents/monitoring/index.js"
import { createRequire } from "node:module"
import { resolvePackageJson } from "../../shared/runtime/root.js"
import { copyToSystemClipboard } from "./utils/clipboard"
import { checkOnboardRequirements, createWorkflowExecution, saveOnboardResult } from "./handlers/workflow-handlers"
import type { TrackConfig, ConditionConfig } from "../../workflows/templates/types"
import type { AgentDefinition } from "../../shared/agents/config/types"
import type { InitialToast } from "./app"

// Module-level view state for post-processing effects
export let currentView: "home" | "onboard" | "workflow" = "home"

export function App(props: { initialToast?: InitialToast }) {
  const dimensions = useTerminalDimensions()
  const themeCtx = useTheme()
  const session = useSession()
  const updateNotifier = useUpdateNotifier()
  const renderer = useRenderer()
  const toast = useToast()
  const kv = useKV()

  // Global error handler - any part of the app can emit 'app:error' to show a toast
  const handleAppError = (data: { message: string; duration?: number }) => {
    toast.show({
      variant: "error",
      message: data.message,
      duration: data.duration ?? 0, // permanent by default
    })
  }
  ;(process as NodeJS.EventEmitter).on('app:error', handleAppError)

  const [ctrlCPressed, setCtrlCPressed] = createSignal(false)
  let ctrlCTimeout: NodeJS.Timeout | null = null
  const [view, setView] = createSignal<"home" | "onboard" | "workflow">("home")
  const [workflowEventBus, setWorkflowEventBus] = createSignal<WorkflowEventBus | null>(null)
  const [templateTracks, setTemplateTracks] = createSignal<Record<string, TrackConfig> | null>(null)
  const [templateConditions, setTemplateConditions] = createSignal<Record<string, ConditionConfig> | null>(null)
  const [initialProjectName, setInitialProjectName] = createSignal<string | null>(null)
  const [autopilotAgents, setAutopilotAgents] = createSignal<AgentDefinition[] | null>(null)
  const [onboardLoading, setOnboardLoading] = createSignal(false)
  const [onboardLoadingMessage, setOnboardLoadingMessage] = createSignal("")

  let pendingWorkflowStart: (() => void) | null = null

  const handleAdapterReady = () => {
    if (pendingWorkflowStart) {
      pendingWorkflowStart()
      pendingWorkflowStart = null
    }
  }

  const handleStartWorkflow = async () => {
    const requirements = await checkOnboardRequirements()

    if (requirements.needsOnboard) {
      if (requirements.tracks) setTemplateTracks(requirements.tracks)
      if (requirements.conditions) setTemplateConditions(requirements.conditions)
      if (requirements.autopilots) setAutopilotAgents(requirements.autopilots)
      setInitialProjectName(requirements.existingProjectName)
      currentView = "onboard"
      setView("onboard")
      return
    }

    startWorkflowExecution()
  }

  const startWorkflowExecution = () => {
    const { eventBus, startWorkflow } = createWorkflowExecution()
    setWorkflowEventBus(eventBus)
    pendingWorkflowStart = startWorkflow
    currentView = "workflow"
    setView("workflow")
  }

  const handleOnboardComplete = async (result: { projectName?: string; trackId?: string; conditions?: string[]; autopilotAgentId?: string }) => {
    await saveOnboardResult(
      result,
      autopilotAgents(),
      (loading, message) => {
        setOnboardLoading(loading)
        if (message) setOnboardLoadingMessage(message)
      }
    )
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
    const require = createRequire(import.meta.url)
    const packageJsonPath = resolvePackageJson(import.meta.url, "app component")
    const pkg = require(packageJsonPath) as { version: string }
    return pkg.version
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
              conditions={templateConditions() ?? undefined}
              autopilotAgents={autopilotAgents() ?? undefined}
              initialProjectName={initialProjectName()}
              onComplete={handleOnboardComplete}
              onCancel={handleOnboardCancel}
              isLoading={onboardLoading()}
              loadingMessage={onboardLoadingMessage()}
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
              <text fg={themeCtx.theme.primary} attributes={TextAttributes.BOLD}>{String(session.templateName).toUpperCase()}</text>
            </box>
          </box>
        </box>
      </Show>
    </box>
  )
}
