/** @jsxImportSource @opentui/solid */
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { createMemo, createSignal, onMount, onCleanup } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { resolvePackageJson } from "../../../shared/runtime/pkg.js"
import { BrandingHeader } from "@tui/component/layout/branding-header"
import { useTheme } from "@tui/context/theme"
import { UIStateProvider, useUIState } from "@tui/context/ui-state"
import { AgentTimeline } from "@tui/component/timeline"
import { OutputWindow } from "@tui/component/output"
import { TelemetryBar } from "@tui/component/output"
import { StatusFooter } from "@tui/component/output"
import { formatRuntime } from "@tui/state/formatters"
import { OpenTUIAdapter } from "@tui/adapters/opentui"
import { useLogStream } from "@tui/hooks/useLogStream"
import type { WorkflowEventBus } from "../../../workflows/events/index.js"

interface WorkflowProps {
  eventBus?: WorkflowEventBus | null
  onAdapterReady?: () => void
}

export function Workflow(props: WorkflowProps) {
  const getVersion = () => {
    const require = createRequire(import.meta.url)
    const packageJsonPath = resolvePackageJson(import.meta.url, "workflow route")
    const pkg = require(packageJsonPath) as { version: string }
    return pkg.version
  }

  const getCwd = () => {
    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    return cwd.replace(homedir(), "~")
  }

  return (
    <UIStateProvider workflowName="CodeMachine Workflow">
      <WorkflowShell version={getVersion()} currentDir={getCwd()} eventBus={props.eventBus} onAdapterReady={props.onAdapterReady} />
    </UIStateProvider>
  )
}

function WorkflowShell(props: { version: string; currentDir: string; eventBus?: WorkflowEventBus | null; onAdapterReady?: () => void }) {
  const themeCtx = useTheme()
  const ui = useUIState()
  const state = () => ui.state()

  // Connect to the event bus from workflow execution
  let adapter: OpenTUIAdapter | null = null

  onMount(() => {
    // Use event bus passed from props
    const eventBus = props.eventBus

    if (eventBus) {
      // Create adapter with UI actions
      adapter = new OpenTUIAdapter({ actions: ui.actions })
      adapter.connect(eventBus)
      adapter.start()

      // Signal that adapter is ready to receive events
      props.onAdapterReady?.()
    }
  })

  onCleanup(() => {
    if (adapter) {
      adapter.stop()
      adapter.disconnect()
    }
  })

  // Track runtime with periodic updates
  const [tick, setTick] = createSignal(0)
  setInterval(() => setTick((t) => t + 1), 1000)

  const runtime = createMemo(() => {
    tick() // Re-evaluate on tick
    return formatRuntime(state().startTime, state().endTime)
  })

  // Get current agent for output window
  const currentAgent = createMemo(() => {
    const s = state()
    if (s.selectedItemType === "sub" && s.selectedSubAgentId) {
      for (const subAgents of s.subAgents.values()) {
        const found = subAgents.find((sa) => sa.id === s.selectedSubAgentId)
        if (found) return found
      }
    }
    if (s.selectedAgentId) {
      return s.agents.find((a) => a.id === s.selectedAgentId) ?? null
    }
    // Default to last running or most recent agent
    const running = s.agents.find((a) => a.status === "running")
    if (running) return running
    return s.agents[s.agents.length - 1] ?? null
  })

  // Get monitoring ID for current agent (for log streaming)
  const currentMonitoringId = () => currentAgent()?.monitoringId

  // Stream logs for current agent
  const logStream = useLogStream(currentMonitoringId)

  // Calculate total telemetry
  const totalTelemetry = createMemo(() => {
    const s = state()
    let tokensIn = 0
    let tokensOut = 0
    let cached = 0

    for (const agent of s.agents) {
      tokensIn += agent.telemetry.tokensIn
      tokensOut += agent.telemetry.tokensOut
      cached += agent.telemetry.cached ?? 0
    }

    for (const subAgents of s.subAgents.values()) {
      for (const sub of subAgents) {
        tokensIn += sub.telemetry.tokensIn
        tokensOut += sub.telemetry.tokensOut
        cached += sub.telemetry.cached ?? 0
      }
    }

    return { tokensIn, tokensOut, cached: cached > 0 ? cached : undefined }
  })

  // Handle expand toggle
  const handleToggleExpand = (agentId: string) => {
    ui.actions.toggleExpand(agentId)
  }

  // Keyboard navigation for workflow view
  useKeyboard((evt) => {
    // Arrow up - navigate to previous item
    if (evt.name === "up") {
      evt.preventDefault()
      ui.actions.navigateUp()
      return
    }

    // Arrow down - navigate to next item
    if (evt.name === "down") {
      evt.preventDefault()
      ui.actions.navigateDown()
      return
    }

    // Enter or Space - toggle expand on selected agent
    if (evt.name === "return" || evt.name === "space") {
      evt.preventDefault()
      const s = state()
      if (s.selectedAgentId && (s.selectedItemType === "main" || s.selectedItemType === "summary")) {
        ui.actions.toggleExpand(s.selectedAgentId)
      }
      return
    }

    // Ctrl+S - skip current agent
    if (evt.ctrl && evt.name === "s") {
      evt.preventDefault()
      ;(process as NodeJS.EventEmitter).emit("workflow:skip")
      return
    }
  })

  return (
    <box flexDirection="column" height="100%">
      {/* Header */}
      <BrandingHeader version={props.version} currentDir={props.currentDir} />

      {/* Main content area - Timeline and Output side by side */}
      <box flexDirection="row" flexGrow={1} gap={1}>
        {/* Timeline Panel */}
        <box
          flexDirection="column"
          width="50%"
          border
          borderColor={themeCtx.theme.borderSubtle}
          backgroundColor={themeCtx.theme.backgroundPanel}
        >
          <AgentTimeline
            state={state()}
            onToggleExpand={handleToggleExpand}
            availableHeight={state().visibleItemCount}
          />
        </box>

        {/* Output Panel */}
        <box
          flexDirection="column"
          width="50%"
          border
          borderColor={themeCtx.theme.borderSubtle}
          backgroundColor={themeCtx.theme.backgroundPanel}
        >
          <OutputWindow
            currentAgent={currentAgent()}
            lines={logStream.lines}
            isLoading={logStream.isLoading}
            isConnecting={logStream.isConnecting}
            error={logStream.error}
            maxLines={state().visibleItemCount}
          />
        </box>
      </box>

      {/* Footer */}
      <TelemetryBar
        workflowName={state().workflowName}
        runtime={runtime()}
        status={state().workflowStatus}
        total={totalTelemetry()}
      />
      <StatusFooter />
    </box>
  )
}
