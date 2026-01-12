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
import { CheckpointModal, LogViewer, HistoryView, StopModal, ErrorModal, TransitionModal } from "./components/modals"
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

  // Local state for controller ID (to detect if current agent is controller)
  const [controllerAgentId, setControllerAgentId] = createSignal<string | null>(null)

  // Controller is active when:
  // 1. We have a controller configured
  // 2. Autonomous mode is NOT enabled (user hasn't transitioned yet)
  const isControllerActive = () => {
    const autoMode = state().autonomousMode
    const controllerId = controllerAgentId()

    debug('[isControllerActive] autoMode=%s, controllerId=%s', autoMode, controllerId ?? 'null')

    if (autoMode) return false
    if (!controllerId) return false
    return true
  }

  // Auto-collapse/expand timeline based on controller activity
  // Collapse once when entering controller mode, expand when exiting
  // After initial collapse, user can manually toggle with Tab
  createEffect((wasControllerActive: boolean | undefined) => {
    const isController = isControllerActive()
    const isCollapsed = state().timelineCollapsed

    // Debug transition state
    debug('[TimelineEffect] check: active=%s prev=%s collapsed=%s', isController, wasControllerActive, isCollapsed)

    // Transition TO controller mode (undefined/false -> true): auto-collapse ONCE
    if (isController && wasControllerActive !== true) {
      if (!isCollapsed) {
        debug('[TimelineEffect] Action: Collapse (Entering Controller Mode)')
        ui.actions.setTimelineCollapsed(true)
      }
    }

    // Transition FROM controller mode (true -> false): auto-expand
    if (!isController && wasControllerActive === true) {
      debug('[TimelineEffect] Transition Detected (Controller -> Next Agent)')
      if (isCollapsed) {
        debug('[TimelineEffect] Action: Expand')
        ui.actions.setTimelineCollapsed(false)
      }
    }

    return isController
  })

  // Reload controller config helper
  const refreshControllerConfig = async () => {
    const cmRoot = path.join(resolvePath(props.currentDir), '.codemachine')
    const controllerState = await loadControllerConfig(cmRoot)
    debug('[ConfigSync] Loaded state: %s', JSON.stringify(controllerState))

    if (controllerState?.controllerConfig?.agentId) {
      debug('[ConfigSync] Setting controllerAgentId signal to: %s', controllerState.controllerConfig.agentId)
      setControllerAgentId(controllerState.controllerConfig.agentId)
    }

    // Update autonomous mode - prefer config (source of truth)
    if (typeof controllerState?.autonomousMode === 'boolean') {
      ui.actions.setAutonomousMode(controllerState.autonomousMode)
    }
  }

  onMount(async () => {
    ;(process as NodeJS.EventEmitter).on('workflow:error', handleWorkflowError)
    ;(process as NodeJS.EventEmitter).on('workflow:stopping', handleStopping)
    ;(process as NodeJS.EventEmitter).on('workflow:user-stop', handleUserStop)
    ;(process as NodeJS.EventEmitter).on('workflow:mode-change', handleModeChange)

    // Initial load
    await refreshControllerConfig()

    if (props.eventBus) {
      // Subscribe to workflow:started to get controller ID
      const handleWorkflowStarted = (event: { type: string; controllerAgentId?: string }) => {
        if (event.type === 'workflow:started' && event.controllerAgentId) {
          debug('[WorkflowShell] Received controllerAgentId from workflow:started: %s', event.controllerAgentId)
          setControllerAgentId(event.controllerAgentId)
        }
      }
      props.eventBus.subscribe(handleWorkflowStarted)

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

  // Refresh config when workflow starts running or awaits input (ensures sync with run.ts changes)
  createEffect(() => {
    const status = state().workflowStatus
    if (status === "running" || status === "awaiting") {
      refreshControllerConfig()
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

  // Transition confirmation modal state (Controller -> Workflow)
  const [showTransitionModal, setShowTransitionModal] = createSignal(false)

  const handleTransitionConfirm = async () => {
    setShowTransitionModal(false)
    // Set autonomous mode (this also effectively marks controller phase as complete)
    const cmRoot = path.join(resolvePath(props.currentDir), '.codemachine')
    await persistAutonomousMode(cmRoot, true)
    ui.actions.setAutonomousMode(true)
    // Skip the current input to advance (workflow:input skip works when waiting for input)
    debug('[Transition] Emitting workflow:input skip to advance past controller')
      ; (process as NodeJS.EventEmitter).emit("workflow:input", { skip: true })
    setIsPromptBoxFocused(false)
    toast.show({ variant: "success", message: "Starting workflow...", duration: 3000 })
  }

  const handleTransitionCancel = () => {
    setShowTransitionModal(false)
  }

  // Unified prompt submit handler - uses single workflow:input event
  const handlePromptSubmit = (prompt: string) => {
    if (isWaitingForInput()) {
      // During controller mode, empty Enter shows transition dialog
      if (isControllerActive() && !prompt.trim()) {
        debug('[handlePromptSubmit] Empty Enter in controller mode - showing transition dialog')
        setShowTransitionModal(true)
        return
      }
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
    isModalBlocking: () => isCheckpointActive() || modals.isLogViewerActive() || modals.isHistoryActive() || modals.isHistoryLogViewerActive() || showStopModal() || showTransitionModal() || isErrorModalActive(),
    isPromptBoxFocused: () => isPromptBoxFocused(),
    isWaitingForInput,
    hasQueuedPrompts,
    openLogViewer: modals.setLogViewerAgentId,
    openHistory: () => modals.setShowHistory(true),
    pauseWorkflow,
    handleSkip,
    showStopConfirmation: () => setShowStopModal(true),
    showTransitionConfirmation: () => setShowTransitionModal(true),
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
    isControllerActive,
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
        <StatusFooter autonomousMode={state().autonomousMode} isControllerActive={isControllerActive()} />
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

      <Show when={showTransitionModal()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <TransitionModal onConfirm={handleTransitionConfirm} onCancel={handleTransitionCancel} />
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
