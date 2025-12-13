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
import { useToast } from "@tui/shared/context/toast"
import { useUIState } from "./context/ui-state"
import { AgentTimeline } from "./components/timeline"
import { OutputWindow, TelemetryBar, StatusFooter } from "./components/output"
import { formatRuntime } from "./state/formatters"
import { CheckpointModal, LogViewer, HistoryView, StopModal, ErrorModal } from "./components/modals"
import { OpenTUIAdapter } from "./adapters/opentui"
import { useLogStream } from "./hooks/useLogStream"
import { useSubAgentSync } from "./hooks/useSubAgentSync"
import { useWorkflowModals } from "./hooks/use-workflow-modals"
import { useWorkflowKeyboard } from "./hooks/use-workflow-keyboard"
import { calculateVisibleItems } from "./constants"
import type { WorkflowEventBus } from "../../../../workflows/events/index.js"
import { setAutonomousMode as persistAutonomousMode, loadControllerConfig } from "../../../../shared/workflows/index.js"
import path from "path"

export interface WorkflowShellProps {
  version: string
  currentDir: string
  eventBus?: WorkflowEventBus | null
  onAdapterReady?: () => void
}

export function WorkflowShell(props: WorkflowShellProps) {
  const themeCtx = useTheme()
  const ui = useUIState()
  const toast = useToast()
  const state = () => ui.state()
  const dimensions = useTerminalDimensions()
  const modals = useWorkflowModals()

  const getVisibleItems = () => calculateVisibleItems(dimensions()?.height ?? 30)

  // Show toast on workflow status change
  createEffect((prevStatus: string | undefined) => {
    const status = state().workflowStatus
    if (prevStatus && prevStatus !== status) {
      switch (status) {
        case "stopping":
          toast.show({ variant: "warning", message: "Press Ctrl+C again to exit", duration: 3000 })
          break
        case "completed":
          toast.show({ variant: "success", message: "Workflow completed!", duration: 4000 })
          break
        case "stopped":
          toast.show({ variant: "error", message: "Stopped by user", duration: 3000 })
          break
        case "checkpoint":
          toast.show({ variant: "warning", message: "Checkpoint - Review Required", duration: 5000 })
          break
      }
    }
    return status
  })

  // Responsive: hide output panel on narrow terminals
  const MIN_WIDTH_FOR_SPLIT_VIEW = 100
  const showOutputPanel = () => (dimensions()?.width ?? 80) >= MIN_WIDTH_FOR_SPLIT_VIEW

  // Timeline collapsed state (toggled with Tab key)
  const isTimelineCollapsed = () => state().timelineCollapsed

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

  const handleUserStop = () => {
    setCheckpointFreezeTime(Date.now())
    ui.actions.setWorkflowStatus("stopped")
  }

  // Error modal state
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const isErrorModalActive = () => errorMessage() !== null

  const handleWorkflowError = (data: { reason: string }) => {
    // Only set error message - workflow status is already set via event bus adapter
    setErrorMessage(data.reason)
  }

  const handleErrorModalClose = () => {
    setErrorMessage(null)
  }

  onMount(async () => {
    ;(process as NodeJS.EventEmitter).on('workflow:error', handleWorkflowError)
    ;(process as NodeJS.EventEmitter).on('workflow:stopping', handleStopping)
    ;(process as NodeJS.EventEmitter).on('workflow:user-stop', handleUserStop)

    // Load initial autonomous mode state
    const cmRoot = path.join(props.currentDir, '.codemachine')
    const controllerState = await loadControllerConfig(cmRoot)
    if (controllerState?.autonomousMode) {
      ui.actions.setAutonomousMode(true)
    }

    if (props.eventBus) {
      adapter = new OpenTUIAdapter({ actions: ui.actions })
      adapter.connect(props.eventBus)
      adapter.start()
      props.onAdapterReady?.()
    }
  })

  onCleanup(() => {
    ;(process as NodeJS.EventEmitter).off('workflow:error', handleWorkflowError)
    ;(process as NodeJS.EventEmitter).off('workflow:stopping', handleStopping)
    ;(process as NodeJS.EventEmitter).off('workflow:user-stop', handleUserStop)
    if (adapter) {
      adapter.stop()
      adapter.disconnect()
    }
  })

  useSubAgentSync(() => state(), ui.actions)

  // Unified input waiting check
  const isWaitingForInput = () => state().inputState?.active ?? false

  // Timer freeze effects
  createEffect(() => {
    const checkpointState = state().checkpointState
    if (checkpointState?.active && !checkpointFreezeTime()) {
      setCheckpointFreezeTime(Date.now())
    } else if (!checkpointState?.active && checkpointFreezeTime() && !isWaitingForInput()) {
      setCheckpointFreezeTime(undefined)
    }
  })

  createEffect(() => {
    if (isWaitingForInput() && !checkpointFreezeTime()) {
      setCheckpointFreezeTime(Date.now())
    } else if (!isWaitingForInput() && checkpointFreezeTime() && !state().checkpointState?.active) {
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

  // Check if we have queued prompts (chained mode)
  const hasQueuedPrompts = (): boolean => {
    const inputSt = state().inputState
    return !!(inputSt?.queuedPrompts && inputSt.queuedPrompts.length > 0)
  }

  // Prompt box focus state (for inline prompt box)
  const [isPromptBoxFocused, setIsPromptBoxFocused] = createSignal(true)

  // Check if output window is showing the running agent (not a manually selected one)
  const isShowingRunningAgent = createMemo(() => {
    const s = state()
    const running = s.agents.find((a) => a.status === "running")
    if (!running) return false
    // If no explicit selection, we're showing the running agent
    if (!s.selectedAgentId) return true
    // If selected agent is the running agent
    return s.selectedAgentId === running.id && s.selectedItemType !== "sub"
  })

  // Auto-focus prompt box when input waiting becomes active
  createEffect(() => {
    if (isWaitingForInput() && isShowingRunningAgent()) {
      setIsPromptBoxFocused(true)
    } else if (!isWaitingForInput()) {
      setIsPromptBoxFocused(false)
    }
  })

  // Stop confirmation modal state
  const [showStopModal, setShowStopModal] = createSignal(false)

  const handleStopConfirm = () => {
    setShowStopModal(false)
    ;(process as NodeJS.EventEmitter).emit("workflow:user-stop")
    ;(process as NodeJS.EventEmitter).emit("workflow:stop")
  }

  const handleStopCancel = () => {
    setShowStopModal(false)
  }

  // Unified prompt submit handler - uses single workflow:input event
  const handlePromptSubmit = (prompt: string) => {
    if (isWaitingForInput()) {
      ;(process as NodeJS.EventEmitter).emit("workflow:input", { prompt: prompt || undefined })
      setIsPromptBoxFocused(false)
    }
  }

  // Skip all remaining prompts
  const handleSkip = () => {
    if (isWaitingForInput()) {
      ;(process as NodeJS.EventEmitter).emit("workflow:input", { skip: true })
      setIsPromptBoxFocused(false)
    }
  }

  // Pause the workflow (aborts current step)
  const pauseWorkflow = () => {
    ;(process as NodeJS.EventEmitter).emit("workflow:pause")
  }

  // Disable autonomous mode
  const disableAutonomousMode = () => {
    const cwd = props.currentDir
    const cmRoot = path.join(cwd, '.codemachine')
    ui.actions.setAutonomousMode(false)
    persistAutonomousMode(cmRoot, false).catch(() => {
      // best-effort persistence
    })
    toast.show({ variant: "warning", message: "Autonomous mode disabled", duration: 3000 })
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
    isModalBlocking: () => isCheckpointActive() || modals.isLogViewerActive() || modals.isHistoryActive() || modals.isHistoryLogViewerActive() || showStopModal() || isErrorModalActive(),
    isPromptBoxFocused: () => isPromptBoxFocused(),
    isWaitingForInput,
    hasQueuedPrompts,
    openLogViewer: modals.setLogViewerAgentId,
    openHistory: () => modals.setShowHistory(true),
    pauseWorkflow,
    handleSkip,
    showStopConfirmation: () => setShowStopModal(true),
    canStop: () => {
      const status = state().workflowStatus
      return status === "running" || status === "paused" || status === "stopping"
    },
    getCurrentAgentId: () => currentAgent()?.id ?? null,
    canFocusPromptBox: () => isWaitingForInput() && isShowingRunningAgent() && !isPromptBoxFocused(),
    focusPromptBox: () => setIsPromptBoxFocused(true),
    exitPromptBoxFocus: () => setIsPromptBoxFocused(false),
    isAutonomousMode: () => state().autonomousMode,
    disableAutonomousMode,
  })

  return (
    <box flexDirection="column" height="100%">
      <box flexShrink={0}>
        <BrandingHeader version={props.version} currentDir={props.currentDir} />
      </box>

      <box flexDirection="row" flexGrow={1} gap={1}>
        <Show when={!isTimelineCollapsed()}>
          <box flexDirection="column" width={showOutputPanel() ? "35%" : "100%"}>
            <AgentTimeline state={state()} onToggleExpand={(id) => ui.actions.toggleExpand(id)} availableHeight={state().visibleItemCount} availableWidth={Math.floor((dimensions()?.width ?? 80) * (showOutputPanel() ? 0.35 : 1))} isPaused={isWaitingForInput()} isPromptBoxFocused={isPromptBoxFocused()} />
          </box>
        </Show>
        <Show when={showOutputPanel() || isTimelineCollapsed()}>
          <box flexDirection="column" width={isTimelineCollapsed() ? "100%" : "65%"}>
            <OutputWindow
              currentAgent={currentAgent()}
              availableWidth={Math.floor((dimensions()?.width ?? 80) * (isTimelineCollapsed() ? 1 : 0.65))}
              lines={logStream.lines}
              isLoading={logStream.isLoading}
              isConnecting={logStream.isConnecting}
              error={logStream.error}
              latestThinking={logStream.latestThinking}
              inputState={isShowingRunningAgent() ? state().inputState : null}
              workflowStatus={state().workflowStatus}
              isPromptBoxFocused={isPromptBoxFocused()}
              onPromptSubmit={handlePromptSubmit}
              onSkip={handleSkip}
              onPromptBoxFocusExit={() => setIsPromptBoxFocused(false)}
            />
          </box>
        </Show>
      </box>

      <box flexShrink={0} flexDirection="column">
        <TelemetryBar workflowName={state().workflowName} runtime={runtime()} status={state().workflowStatus} total={totalTelemetry()} autonomousMode={state().autonomousMode} />
        <StatusFooter autonomousMode={state().autonomousMode} />
      </box>

      <Show when={isCheckpointActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <CheckpointModal reason={state().checkpointState?.reason} onContinue={handleCheckpointContinue} onQuit={handleCheckpointQuit} />
        </box>
      </Show>

      <Show when={modals.isLogViewerActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} backgroundColor={themeCtx.theme.background}>
          <LogViewer agentId={modals.logViewerAgentId()!} getMonitoringId={getMonitoringId} onClose={() => modals.setLogViewerAgentId(null)} />
        </box>
      </Show>

      <Show when={modals.isHistoryActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} backgroundColor={themeCtx.theme.background}>
          <HistoryView onClose={() => modals.setShowHistory(false)} onOpenLogViewer={(id) => { modals.setHistoryLogViewerMonitoringId(id); modals.setShowHistory(false) }} disabled={isCheckpointActive() || isWaitingForInput()} initialSelectedIndex={modals.historySelectedIndex()} onSelectedIndexChange={modals.setHistorySelectedIndex} />
        </box>
      </Show>

      <Show when={modals.isHistoryLogViewerActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={1000} backgroundColor={themeCtx.theme.background}>
          <LogViewer agentId={String(modals.historyLogViewerMonitoringId())} getMonitoringId={() => modals.historyLogViewerMonitoringId() ?? undefined} onClose={() => { modals.setHistoryLogViewerMonitoringId(null); modals.setShowHistory(true) }} />
        </box>
      </Show>

      <Show when={showStopModal()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <StopModal onConfirm={handleStopConfirm} onCancel={handleStopCancel} />
        </box>
      </Show>

      <Show when={isErrorModalActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <ErrorModal message={errorMessage()!} onClose={handleErrorModalClose} />
        </box>
      </Show>
    </box>
  )
}
