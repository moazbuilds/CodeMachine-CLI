/** @jsxImportSource @opentui/solid */
/**
 * Workflow Shell Component
 *
 * Main layout component with timeline, output, and modals.
 */

import { createMemo, createSignal, createEffect, onMount, onCleanup, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { BrandingHeader } from "@tui/shared/components/layout/branding-header"
import { useTheme } from "@tui/shared/context/theme"
import { useUIState } from "./context/ui-state"
import { AgentTimeline } from "./components/timeline"
import { OutputWindow, TelemetryBar, StatusFooter } from "./components/output"
import { formatRuntime } from "./state/formatters"
import { CheckpointModal, LogViewer, HistoryView, PauseModal } from "./components/modals"
import { OpenTUIAdapter } from "./adapters/opentui"
import { useLogStream } from "./hooks/useLogStream"
import { useSubAgentSync } from "./hooks/useSubAgentSync"
import { usePause } from "./hooks/usePause"
import { useWorkflowModals } from "./hooks/use-workflow-modals"
import { useWorkflowKeyboard } from "./hooks/use-workflow-keyboard"
import { calculateVisibleItems } from "./constants"
import type { WorkflowEventBus } from "../../../../workflows/events/index.js"

export interface WorkflowShellProps {
  version: string
  currentDir: string
  eventBus?: WorkflowEventBus | null
  onAdapterReady?: () => void
}

export function WorkflowShell(props: WorkflowShellProps) {
  const themeCtx = useTheme()
  const ui = useUIState()
  const state = () => ui.state()
  const dimensions = useTerminalDimensions()
  const modals = useWorkflowModals()
  const pauseControl = usePause()

  const getVisibleItems = () => calculateVisibleItems(dimensions()?.height ?? 30)

  // Update visible item count when terminal dimensions change
  createEffect(() => {
    ui.actions.setVisibleItemCount(getVisibleItems())
  })

  // Track checkpoint freeze time
  const [checkpointFreezeTime, setCheckpointFreezeTime] = createSignal<number | undefined>(undefined)

  // Connect to event bus
  let adapter: OpenTUIAdapter | null = null

  const handleStopping = () => {
    setCheckpointFreezeTime(Date.now())
    ui.actions.setWorkflowStatus("stopping")
  }

  onMount(() => {
    ;(process as NodeJS.EventEmitter).on('workflow:stopping', handleStopping)
    if (props.eventBus) {
      adapter = new OpenTUIAdapter({ actions: ui.actions })
      adapter.connect(props.eventBus)
      adapter.start()
      props.onAdapterReady?.()
    }
  })

  onCleanup(() => {
    ;(process as NodeJS.EventEmitter).off('workflow:stopping', handleStopping)
    if (adapter) {
      adapter.stop()
      adapter.disconnect()
    }
  })

  useSubAgentSync(() => state(), ui.actions)

  // Timer freeze effects
  createEffect(() => {
    const checkpointState = state().checkpointState
    if (checkpointState?.active && !checkpointFreezeTime()) {
      setCheckpointFreezeTime(Date.now())
    } else if (!checkpointState?.active && checkpointFreezeTime() && !pauseControl.isPaused()) {
      setCheckpointFreezeTime(undefined)
    }
  })

  createEffect(() => {
    if (pauseControl.isPaused() && !checkpointFreezeTime()) {
      setCheckpointFreezeTime(Date.now())
    } else if (!pauseControl.isPaused() && checkpointFreezeTime() && !state().checkpointState?.active) {
      setCheckpointFreezeTime(undefined)
    }
  })

  // Runtime tick
  const [tick, setTick] = createSignal(0)
  const tickInterval = setInterval(() => setTick((t) => t + 1), 1000)
  onCleanup(() => clearInterval(tickInterval))

  // Current agent for output
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
    const running = s.agents.find((a) => a.status === "running")
    if (running) return running
    return s.agents[s.agents.length - 1] ?? null
  })

  const logStream = useLogStream(() => currentAgent()?.monitoringId)

  const runtime = createMemo(() => {
    tick()
    const effectiveEndTime = checkpointFreezeTime() ?? state().endTime
    return formatRuntime(state().startTime, effectiveEndTime)
  })

  const totalTelemetry = createMemo(() => {
    const s = state()
    let tokensIn = 0, tokensOut = 0, cached = 0
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

  const isCheckpointActive = () => state().checkpointState?.active ?? false

  const handleCheckpointContinue = () => {
    ui.actions.setCheckpointState(null)
    ui.actions.setWorkflowStatus("running")
    setCheckpointFreezeTime(undefined)
    ;(process as NodeJS.EventEmitter).emit("checkpoint:continue")
  }

  const handleCheckpointQuit = () => {
    ui.actions.setCheckpointState(null)
    ui.actions.setWorkflowStatus("stopped")
    ;(process as NodeJS.EventEmitter).emit("checkpoint:quit")
  }

  const getMonitoringId = (uiAgentId: string): number | undefined => {
    const s = state()
    const mainAgent = s.agents.find((a) => a.id === uiAgentId)
    if (mainAgent?.monitoringId !== undefined) return mainAgent.monitoringId
    for (const subAgents of s.subAgents.values()) {
      const subAgent = subAgents.find((sa) => sa.id === uiAgentId)
      if (subAgent?.monitoringId !== undefined) return subAgent.monitoringId
    }
    return undefined
  }

  // Keyboard navigation
  useWorkflowKeyboard({
    getState: state,
    actions: ui.actions,
    calculateVisibleItems: getVisibleItems,
    isDisabled: () => isCheckpointActive() || modals.isLogViewerActive() || modals.isHistoryActive() || modals.isHistoryLogViewerActive() || pauseControl.isPaused(),
    openLogViewer: modals.setLogViewerAgentId,
    openHistory: () => modals.setShowHistory(true),
    pauseWorkflow: () => pauseControl.pause(),
    getCurrentAgentId: () => currentAgent()?.id ?? null,
  })

  return (
    <box flexDirection="column" height="100%">
      <box flexShrink={0}>
        <BrandingHeader version={props.version} currentDir={props.currentDir} />
      </box>

      <box flexDirection="row" flexGrow={1} gap={1}>
        <box flexDirection="column" width="50%" border borderColor={themeCtx.theme.borderSubtle} backgroundColor={themeCtx.theme.backgroundPanel}>
          <AgentTimeline state={state()} onToggleExpand={(id) => ui.actions.toggleExpand(id)} availableHeight={state().visibleItemCount} isPaused={pauseControl.isPaused()} />
        </box>
        <box flexDirection="column" width="50%" border borderColor={themeCtx.theme.borderSubtle} backgroundColor={themeCtx.theme.backgroundPanel}>
          <OutputWindow currentAgent={currentAgent()} lines={logStream.lines} isLoading={logStream.isLoading} isConnecting={logStream.isConnecting} error={logStream.error} maxLines={state().visibleItemCount} />
        </box>
      </box>

      <box flexShrink={0} flexDirection="column">
        <TelemetryBar workflowName={state().workflowName} runtime={runtime()} status={state().workflowStatus} total={totalTelemetry()} />
        <StatusFooter />
      </box>

      <Show when={isCheckpointActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <CheckpointModal reason={state().checkpointState?.reason} onContinue={handleCheckpointContinue} onQuit={handleCheckpointQuit} />
        </box>
      </Show>

      <Show when={pauseControl.isPaused()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <PauseModal onResume={(prompt) => pauseControl.resumeWithPrompt(prompt)} onCancel={() => pauseControl.resumeWithPrompt()} />
        </box>
      </Show>

      <Show when={modals.isLogViewerActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} backgroundColor={themeCtx.theme.background}>
          <LogViewer agentId={modals.logViewerAgentId()!} getMonitoringId={getMonitoringId} onClose={() => modals.setLogViewerAgentId(null)} />
        </box>
      </Show>

      <Show when={modals.isHistoryActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} backgroundColor={themeCtx.theme.background}>
          <HistoryView onClose={() => modals.setShowHistory(false)} onOpenLogViewer={(id) => { modals.setHistoryLogViewerMonitoringId(id); modals.setShowHistory(false) }} disabled={isCheckpointActive() || pauseControl.isPaused()} initialSelectedIndex={modals.historySelectedIndex()} onSelectedIndexChange={modals.setHistorySelectedIndex} />
        </box>
      </Show>

      <Show when={modals.isHistoryLogViewerActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} backgroundColor={themeCtx.theme.background}>
          <LogViewer agentId={String(modals.historyLogViewerMonitoringId())} getMonitoringId={() => modals.historyLogViewerMonitoringId() ?? undefined} onClose={() => { modals.setHistoryLogViewerMonitoringId(null); modals.setShowHistory(true) }} />
        </box>
      </Show>
    </box>
  )
}
