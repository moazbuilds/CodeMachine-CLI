/** @jsxImportSource @opentui/solid */
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { createMemo, createSignal, createEffect, onMount, onCleanup, Show } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { resolvePackageJson } from "../../../../shared/runtime/pkg.js"
import { BrandingHeader } from "@tui/shared/components/layout/branding-header"
import { useTheme } from "@tui/shared/context/theme"
import { UIStateProvider, useUIState } from "./context/ui-state"
import { AgentTimeline } from "./components/timeline"
import { OutputWindow, TelemetryBar, StatusFooter } from "./components/output"
import { CheckpointModal, LogViewer, HistoryView, PauseModal } from "./components/modals"
import { formatRuntime } from "./state/formatters"
import { OpenTUIAdapter } from "./adapters/opentui"
import { useLogStream } from "./hooks/useLogStream"
import { useSubAgentSync } from "./hooks/useSubAgentSync"
import { usePause } from "./hooks/usePause"
import { MonitoringCleanup } from "../../../../agents/monitoring/index.js"
import type { WorkflowEventBus } from "../../../../workflows/events/index.js"

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

// Fixed heights for header, footer, borders, etc.
const HEADER_HEIGHT = 3  // Branding header
const FOOTER_HEIGHT = 2  // Telemetry bar + status footer
const PANEL_BORDER = 2   // Top and bottom border of panel
const TIMELINE_HEADER = 2  // "Workflow Pipeline" header

function WorkflowShell(props: { version: string; currentDir: string; eventBus?: WorkflowEventBus | null; onAdapterReady?: () => void }) {
  const themeCtx = useTheme()
  const ui = useUIState()
  const state = () => ui.state()
  const dimensions = useTerminalDimensions()

  // Calculate available height for timeline items
  const calculateVisibleItems = () => {
    const termHeight = dimensions()?.height ?? 30
    // Subtract fixed UI elements to get actual viewport for timeline items
    const available = termHeight - HEADER_HEIGHT - FOOTER_HEIGHT - PANEL_BORDER - TIMELINE_HEADER
    return Math.max(5, available)
  }

  // Update visible item count when terminal dimensions change
  createEffect(() => {
    const count = calculateVisibleItems()
    ui.actions.setVisibleItemCount(count)
  })

  // Track checkpoint freeze time to pause the timer (defined early for Ctrl+C handler)
  const [checkpointFreezeTime, setCheckpointFreezeTime] = createSignal<number | undefined>(undefined)

  // Connect to the event bus from workflow execution
  let adapter: OpenTUIAdapter | null = null

  // Register Ctrl+C handlers immediately (not in onMount) to ensure they're
  // available before any Ctrl+C can be pressed
  MonitoringCleanup.registerWorkflowHandlers({
    onStop: () => {
      // First Ctrl+C - freeze timer and update status to 'stopping'
      setCheckpointFreezeTime(Date.now())
      ui.actions.setWorkflowStatus("stopping")
    },
    onExit: () => {
      // Second Ctrl+C - update status to 'stopped' (UI will show "Stopped by user")
      ui.actions.setWorkflowStatus("stopped")
    },
  })

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
    // Clear workflow handlers to prevent memory leaks
    MonitoringCleanup.clearWorkflowHandlers()
  })

  // Sync tool-spawned sub-agents from AgentMonitorService
  useSubAgentSync(() => state(), ui.actions)

  // Pause/resume control
  const pauseControl = usePause()

  // Track log viewer state
  const [logViewerAgentId, setLogViewerAgentId] = createSignal<string | null>(null)

  // Track history view state
  const [showHistory, setShowHistory] = createSignal(false)

  // Track history log viewer (opened from history view)
  const [historyLogViewerMonitoringId, setHistoryLogViewerMonitoringId] = createSignal<number | null>(null)

  // Track when checkpoint becomes active/inactive and freeze/unfreeze timer
  createEffect(() => {
    const checkpointState = state().checkpointState
    if (checkpointState?.active && !checkpointFreezeTime()) {
      // Checkpoint just became active - freeze the timer at current time
      setCheckpointFreezeTime(Date.now())
    } else if (!checkpointState?.active && checkpointFreezeTime()) {
      // Checkpoint just closed - unfreeze timer
      setCheckpointFreezeTime(undefined)
    }
  })

  // Track runtime with periodic updates
  const [tick, setTick] = createSignal(0)
  const tickInterval = setInterval(() => setTick((t) => t + 1), 1000)
  onCleanup(() => clearInterval(tickInterval))

  const runtime = createMemo(() => {
    tick() // Re-evaluate on tick
    // Use checkpoint freeze time if active, otherwise use workflow endTime
    const effectiveEndTime = checkpointFreezeTime() ?? state().endTime
    return formatRuntime(state().startTime, effectiveEndTime)
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

  // Check if checkpoint modal is active
  const isCheckpointActive = () => state().checkpointState?.active ?? false

  // Handle checkpoint continue
  const handleCheckpointContinue = () => {
    // Clear checkpoint state first
    ui.actions.setCheckpointState(null)
    // Reset workflow status to running
    ui.actions.setWorkflowStatus("running")
    // Unfreeze the timer
    setCheckpointFreezeTime(undefined)
    // Emit event to continue workflow
    ;(process as NodeJS.EventEmitter).emit("checkpoint:continue")
  }

  // Handle checkpoint quit
  const handleCheckpointQuit = () => {
    // Clear checkpoint state
    ui.actions.setCheckpointState(null)
    // Set status to stopped
    ui.actions.setWorkflowStatus("stopped")
    // Emit event to quit workflow
    ;(process as NodeJS.EventEmitter).emit("checkpoint:quit")
  }

  // Check if log viewer is active
  const isLogViewerActive = () => logViewerAgentId() !== null

  // Check if history view is active
  const isHistoryActive = () => showHistory()

  // Check if history log viewer is active
  const isHistoryLogViewerActive = () => historyLogViewerMonitoringId() !== null

  // Helper function to get monitoring ID from UI agent ID
  const getMonitoringId = (uiAgentId: string): number | undefined => {
    const s = state()
    // Check main agents
    const mainAgent = s.agents.find((a) => a.id === uiAgentId)
    if (mainAgent?.monitoringId !== undefined) {
      return mainAgent.monitoringId
    }
    // Check sub-agents
    for (const subAgents of s.subAgents.values()) {
      const subAgent = subAgents.find((sa) => sa.id === uiAgentId)
      if (subAgent?.monitoringId !== undefined) {
        return subAgent.monitoringId
      }
    }
    return undefined
  }

  // Keyboard navigation for workflow view (disabled when modals are active)
  useKeyboard((evt) => {
    // Disable navigation when modals are active (including pause modal)
    if (isCheckpointActive() || isLogViewerActive() || isHistoryActive() || isHistoryLogViewerActive() || pauseControl.isPaused()) {
      return
    }

    // H key - toggle history view
    if (evt.name === "h") {
      evt.preventDefault()
      setShowHistory(true)
      return
    }

    // P key - pause workflow (modal will handle resume)
    if (evt.name === "p") {
      evt.preventDefault()
      pauseControl.pause()
      return
    }

    // Arrow up - navigate to previous item
    if (evt.name === "up") {
      evt.preventDefault()
      ui.actions.navigateUp(calculateVisibleItems())
      return
    }

    // Arrow down - navigate to next item
    if (evt.name === "down") {
      evt.preventDefault()
      ui.actions.navigateDown(calculateVisibleItems())
      return
    }

    // Enter key has dual functionality:
    // 1. If summary row selected -> toggle expand/collapse
    // 2. If main agent or subagent selected -> open log viewer
    if (evt.name === "return") {
      evt.preventDefault()
      const s = state()
      if (s.selectedItemType === "summary" && s.selectedAgentId) {
        // Toggle expand/collapse for summary
        ui.actions.toggleExpand(s.selectedAgentId)
      } else {
        // Open log viewer for main agent or subagent
        const agentId = s.selectedSubAgentId || s.selectedAgentId
        if (agentId) {
          setLogViewerAgentId(agentId)
        }
      }
      return
    }

    // Space - toggle expand on selected agent
    if (evt.name === "space") {
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

      {/* Checkpoint Modal Overlay */}
      <Show when={isCheckpointActive()}>
        <CheckpointModal
          reason={state().checkpointState?.reason}
          onContinue={handleCheckpointContinue}
          onQuit={handleCheckpointQuit}
        />
      </Show>

      {/* Pause Modal Overlay */}
      <Show when={pauseControl.isPaused()}>
        <PauseModal
          onResume={(prompt) => pauseControl.resumeWithPrompt(prompt)}
          onCancel={() => pauseControl.resumeWithPrompt()}
        />
      </Show>

      {/* Log Viewer Full Screen */}
      <Show when={isLogViewerActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} backgroundColor={themeCtx.theme.background}>
          <LogViewer
            agentId={logViewerAgentId()!}
            getMonitoringId={getMonitoringId}
            onClose={() => setLogViewerAgentId(null)}
          />
        </box>
      </Show>

      {/* History View Full Screen */}
      <Show when={isHistoryActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} backgroundColor={themeCtx.theme.background}>
          <HistoryView
            onClose={() => setShowHistory(false)}
            onOpenLogViewer={(monitoringId) => {
              setHistoryLogViewerMonitoringId(monitoringId)
              setShowHistory(false)
            }}
          />
        </box>
      </Show>

      {/* History Log Viewer Full Screen (opened from history view) */}
      <Show when={isHistoryLogViewerActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} backgroundColor={themeCtx.theme.background}>
          <LogViewer
            agentId={String(historyLogViewerMonitoringId())}
            getMonitoringId={() => historyLogViewerMonitoringId() ?? undefined}
            onClose={() => {
              setHistoryLogViewerMonitoringId(null)
              setShowHistory(true) // Return to history view
            }}
          />
        </box>
      </Show>
    </box>
  )
}
