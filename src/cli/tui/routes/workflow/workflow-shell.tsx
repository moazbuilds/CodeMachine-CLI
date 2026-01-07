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
import { useTimer } from "@tui/shared/services"
import { CheckpointModal, LogViewer, HistoryView, StopModal, ErrorModal } from "./components/modals"
import { OpenTUIAdapter } from "./adapters/opentui"
import { useLogStream } from "./hooks/useLogStream"
import { useSubAgentSync } from "./hooks/useSubAgentSync"
import { useWorkflowModals } from "./hooks/use-workflow-modals"
import { useWorkflowKeyboard } from "./hooks/use-workflow-keyboard"
import { calculateVisibleItems } from "./constants"
import type { WorkflowEventBus } from "../../../../workflows/events/index.js"
import { setAutonomousMode as persistAutonomousMode, loadControllerConfig } from "../../../../shared/workflows/index.js"
import { debug } from "../../../../shared/logging/logger.js"
import path from "path"

/** Expand ~ to home directory if present */
const resolvePath = (dir: string): string =>
  dir.startsWith('~') ? dir.replace('~', process.env.HOME || '') : dir

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
  const timer = useTimer()

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
        case "awaiting":
          toast.show({ variant: "warning", message: "Awaiting - Input Required", duration: 5000 })
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

  // Connect to event bus
  let adapter: OpenTUIAdapter | null = null

  const handleStopping = () => {
    ui.actions.setWorkflowStatus("stopping")
  }

  const handleUserStop = () => {
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

  // Mode change listener - syncs UI state when autonomousMode changes
  const handleModeChange = (data: { autonomousMode: boolean }) => {
    debug('[MODE-CHANGE] Received event: autonomousMode=%s', data.autonomousMode)
    ui.actions.setAutonomousMode(data.autonomousMode)
  }

  onMount(async () => {
    ;(process as NodeJS.EventEmitter).on('workflow:error', handleWorkflowError)
    ;(process as NodeJS.EventEmitter).on('workflow:stopping', handleStopping)
    ;(process as NodeJS.EventEmitter).on('workflow:user-stop', handleUserStop)
    ;(process as NodeJS.EventEmitter).on('workflow:mode-change', handleModeChange)

    // Load initial autonomous mode state
    const cmRoot = path.join(resolvePath(props.currentDir), '.codemachine')
    debug('onMount - loading controller config from: %s', cmRoot)
    const controllerState = await loadControllerConfig(cmRoot)
    debug('onMount - controllerState: %s', JSON.stringify(controllerState))
    if (controllerState?.autonomousMode) {
      debug('onMount - setting autonomousMode to true')
      ui.actions.setAutonomousMode(true)
    } else {
      debug('onMount - autonomousMode not enabled in config')
    }

    if (props.eventBus) {
      // Extend actions with showToast from toast context
      const actionsWithToast = {
        ...ui.actions,
        showToast: (variant: "success" | "error" | "info" | "warning", message: string) => {
          toast.show({ variant, message, duration: 7000 })
        }
      }
      adapter = new OpenTUIAdapter({ actions: actionsWithToast })
      adapter.connect(props.eventBus)
      adapter.start()
      props.onAdapterReady?.()
    }
  })

  onCleanup(() => {
    ;(process as NodeJS.EventEmitter).off('workflow:error', handleWorkflowError)
    ;(process as NodeJS.EventEmitter).off('workflow:stopping', handleStopping)
    ;(process as NodeJS.EventEmitter).off('workflow:user-stop', handleUserStop)
    ;(process as NodeJS.EventEmitter).off('workflow:mode-change', handleModeChange)
    if (adapter) {
      adapter.stop()
      adapter.disconnect()
    }
  })

  useSubAgentSync(() => state(), ui.actions)

  // Unified input waiting check
  const isWaitingForInput = () => state().inputState?.active ?? false

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
    // Check for running, delegated, or awaiting (resumed) agents
    const active = s.agents.find((a) => a.status === "running" || a.status === "delegated" || a.status === "awaiting")
    if (active) return active
    return s.agents[s.agents.length - 1] ?? null
  })

  const logStream = useLogStream(() => currentAgent()?.monitoringId)

  // Memoized total telemetry - only recalculates when agent/subagent/controller telemetry actually changes
  const totalTelemetry = createMemo((prev: { tokensIn: number; tokensOut: number; cached?: number } | undefined) => {
    const agents = state().agents
    const subAgents = state().subAgents
    const controller = state().controllerState
    let tokensIn = 0, tokensOut = 0, cached = 0

    for (const agent of agents) {
      tokensIn += agent.telemetry.tokensIn
      tokensOut += agent.telemetry.tokensOut
      cached += agent.telemetry.cached ?? 0
    }
    for (const subs of subAgents.values()) {
      for (const sub of subs) {
        tokensIn += sub.telemetry.tokensIn
        tokensOut += sub.telemetry.tokensOut
        cached += sub.telemetry.cached ?? 0
      }
    }
    // Include controller telemetry
    if (controller?.telemetry) {
      tokensIn += controller.telemetry.tokensIn
      tokensOut += controller.telemetry.tokensOut
      cached += controller.telemetry.cached ?? 0
    }

    const result = { tokensIn, tokensOut, cached: cached > 0 ? cached : undefined }

    // Only log when values actually change
    if (!prev || prev.tokensIn !== tokensIn || prev.tokensOut !== tokensOut || prev.cached !== result.cached) {
      debug('[TELEMETRY:6-TOTAL] totalTokensIn=%d, totalTokensOut=%d, totalCached=%s',
        tokensIn, tokensOut, result.cached)
    }

    return result
  })

  const isCheckpointActive = () => state().checkpointState?.active ?? false

  const handleCheckpointContinue = () => {
    ui.actions.setCheckpointState(null)
    ui.actions.setWorkflowStatus("running")
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

  // Check if output window is showing the active agent (running or at checkpoint)
  const isShowingRunningAgent = createMemo(() => {
    const s = state()
    const active = s.agents.find((a) => a.status === "running" || a.status === "delegated" || a.status === "awaiting")
    if (!active) return false
    // If no explicit selection, we're showing the active agent
    if (!s.selectedAgentId) return true
    // If selected agent is the active agent
    return s.selectedAgentId === active.id && s.selectedItemType !== "sub"
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
    ;(process as NodeJS.EventEmitter).emit("workflow:return-home")
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

  // Toggle autonomous mode on/off
  const toggleAutonomousMode = async () => {
    const cmRoot = path.join(resolvePath(props.currentDir), '.codemachine')

    // Read current state from file (source of truth)
    const controllerState = await loadControllerConfig(cmRoot)
    debug('[TOGGLE] controllerState: %s', JSON.stringify(controllerState))
    const currentMode = controllerState?.autonomousMode ?? false
    const newMode = !currentMode

    debug('[TOGGLE] Current mode from file: %s, new mode: %s', currentMode, newMode)

    // autoMode can work without controller:
    // - Non-interactive steps (Scenarios 5-6) run autonomously without controller
    // - Interactive steps without controller fall back to user input

    // Update UI state
    ui.actions.setAutonomousMode(newMode)

    // Persist to file (this also emits workflow:mode-change event)
    try {
      await persistAutonomousMode(cmRoot, newMode)
      debug('[TOGGLE] Successfully persisted autonomousMode=%s', newMode)
      toast.show({
        variant: newMode ? "success" : "warning",
        message: newMode ? "Autonomous mode enabled" : "Autonomous mode disabled",
        duration: 3000
      })
    } catch (err) {
      debug('[TOGGLE] Failed to persist autonomousMode: %s', err)
      // Revert UI state on error
      ui.actions.setAutonomousMode(currentMode)
      toast.show({ variant: "error", message: "Failed to toggle autonomous mode", duration: 3000 })
    }
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
    toggleAutonomousMode,
  })

  return (
    <box flexDirection="column" height="100%">
      <box flexShrink={0}>
        <BrandingHeader version={props.version} currentDir={props.currentDir} />
      </box>

      <box flexDirection="row" flexGrow={1} gap={1}>
        <Show when={!isTimelineCollapsed()}>
          <box flexDirection="column" width={showOutputPanel() ? "35%" : "100%"}>
            <AgentTimeline state={state()} onToggleExpand={(id) => ui.actions.toggleExpand(id)} availableHeight={state().visibleItemCount} availableWidth={Math.floor((dimensions()?.width ?? 80) * (showOutputPanel() ? 0.35 : 1))} isPromptBoxFocused={isPromptBoxFocused()} />
          </box>
        </Show>
        <Show when={showOutputPanel() || isTimelineCollapsed()}>
          <box flexDirection="column" width={isTimelineCollapsed() ? "100%" : "65%"}>
            <OutputWindow
              currentAgent={currentAgent()}
              controllerState={state().controllerState}
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
        <TelemetryBar workflowName={state().workflowName} runtime={timer.workflowRuntime()} status={state().workflowStatus} total={totalTelemetry()} autonomousMode={state().autonomousMode} />
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
          <HistoryView onClose={() => modals.setShowHistory(false)} onOpenLogViewer={(id) => { modals.setHistoryLogViewerMonitoringId(id); modals.setShowHistory(false) }} initialSelectedIndex={modals.historySelectedIndex()} onSelectedIndexChange={modals.setHistorySelectedIndex} />
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
