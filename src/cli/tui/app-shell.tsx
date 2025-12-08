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
import { useTheme } from "@tui/shared/context/theme"
import { useSession } from "@tui/shared/context/session"
import { useUpdateNotifier } from "@tui/shared/context/update-notifier"
import { Home } from "@tui/routes/home"
import { Workflow } from "@tui/routes/workflow"
import { homedir } from "os"
import { WorkflowEventBus } from "../../workflows/events/index.js"
import { MonitoringCleanup } from "../../agents/monitoring/index.js"
import path from "path"
import { createRequire } from "node:module"
import { resolvePackageJson } from "../../shared/runtime/pkg.js"
import type { InitialToast } from "./app"

// Module-level view state for post-processing effects
export let currentView: "home" | "workflow" = "home"

export function App(props: { initialToast?: InitialToast }) {
  const dimensions = useTerminalDimensions()
  const themeCtx = useTheme()
  const session = useSession()
  const updateNotifier = useUpdateNotifier()
  const renderer = useRenderer()
  const toast = useToast()
  const kv = useKV()

  const [ctrlCPressed, setCtrlCPressed] = createSignal(false)
  let ctrlCTimeout: NodeJS.Timeout | null = null
  const [view, setView] = createSignal<"home" | "workflow">("home")
  const [workflowEventBus, setWorkflowEventBus] = createSignal<WorkflowEventBus | null>(null)

  let pendingWorkflowStart: (() => void) | null = null

  const handleAdapterReady = () => {
    if (pendingWorkflowStart) {
      pendingWorkflowStart()
      pendingWorkflowStart = null
    }
  }

  const handleStartWorkflow = async () => {
    const eventBus = new WorkflowEventBus()
    setWorkflowEventBus(eventBus)
    // @ts-expect-error - global export for workflow connection
    globalThis.__workflowEventBus = eventBus

    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    const specPath = path.join(cwd, '.codemachine', 'inputs', 'specifications.md')

    pendingWorkflowStart = () => {
      import("../../workflows/execution/queue.js").then(({ runWorkflowQueue }) => {
        runWorkflowQueue({ cwd, specificationPath: specPath }).catch((error) => {
          console.error("Workflow failed:", error)
        })
      })
    }

    currentView = "workflow"
    setView("workflow")
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
      <box flexGrow={1}>
        <Switch>
          <Match when={view() === "home"}>
            <Home initialToast={props.initialToast} onStartWorkflow={handleStartWorkflow} />
          </Match>
          <Match when={view() === "workflow"}>
            <Workflow eventBus={workflowEventBus()} onAdapterReady={handleAdapterReady} />
          </Match>
        </Switch>
      </box>

      <Show when={view() !== "workflow"}>
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
