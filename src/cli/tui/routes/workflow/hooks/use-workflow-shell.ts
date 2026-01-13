/**
 * Workflow Shell Hook
 *
 * Composes all workflow hooks together and provides a unified interface
 * for the workflow shell components.
 */

import { createEffect } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { useToast } from "@tui/shared/context/toast"
import { useTimer } from "@tui/shared/services"
import { useUIState } from "../context/ui-state"
import { useLogStream } from "./useLogStream"
import { useSubAgentSync } from "./useSubAgentSync"
import { useWorkflowModals } from "./use-workflow-modals"
import { useWorkflowKeyboard } from "./use-workflow-keyboard"
import { useWorkflowEvents } from "./use-workflow-events"
import { useWorkflowHandlers } from "./use-workflow-handlers"
import { useWorkflowComputed } from "./use-workflow-computed"
import { calculateVisibleItems } from "../constants"
import { debug } from "../../../../../shared/logging/logger.js"
import type { WorkflowEventBus } from "../../../../../workflows/events/index.js"

export interface UseWorkflowShellOptions {
  version: string
  currentDir: string
  eventBus?: WorkflowEventBus | null
  onAdapterReady?: () => void
}

export function useWorkflowShell(options: UseWorkflowShellOptions) {
  const { currentDir, eventBus, onAdapterReady } = options

  // Core context hooks
  const themeCtx = useTheme()
  const ui = useUIState()
  const toast = useToast()
  const dimensions = useTerminalDimensions()
  const timer = useTimer()
  const modals = useWorkflowModals()

  // State accessor
  const state = () => ui.state()

  // Helper for visible items calculation
  const getVisibleItems = () => calculateVisibleItems(dimensions()?.height ?? 30)

  // Toast helper
  const showToast = (variant: "success" | "error" | "info" | "warning", message: string, duration = 7000) => {
    toast.show({ variant, message, duration })
  }

  // Computed values
  const computed = useWorkflowComputed({ getState: state })

  // Handlers (needs computed values)
  const handlers = useWorkflowHandlers({
    currentDir,
    actions: ui.actions,
    showToast,
    isWaitingForInput: computed.isWaitingForInput,
    isControllerView: computed.isControllerView
  })

  // Events (adapter, process events)
  const events = useWorkflowEvents({
    currentDir,
    eventBus,
    actions: ui.actions,
    showToast,
    onAdapterReady
  })

  // Sync sub-agents
  useSubAgentSync(() => state(), ui.actions)

  // Log stream - view-aware
  const logStream = useLogStream(() => {
    const s = state()
    if (s.view === 'controller') {
      return s.controllerState?.monitoringId
    }
    return computed.currentAgent()?.monitoringId
  })

  // Show toast on workflow status change
  createEffect((prevStatus: string | undefined) => {
    const status = state().workflowStatus
    if (prevStatus && prevStatus !== status) {
      switch (status) {
        case "stopping":
          showToast("warning", "Press Ctrl+C again to exit", 3000)
          break
        case "completed":
          showToast("success", "Workflow completed!", 4000)
          break
        case "stopped":
          showToast("error", "Stopped by user", 3000)
          break
        case "awaiting":
          showToast("warning", "Awaiting - Input Required", 5000)
          break
      }
    }
    return status
  })

  // Update visible item count when terminal dimensions change
  createEffect(() => {
    ui.actions.setVisibleItemCount(getVisibleItems())
  })

  // Auto-focus prompt box when input waiting becomes active
  createEffect(() => {
    if (computed.isWaitingForInput() && (computed.isShowingRunningAgent() || computed.isControllerView())) {
      handlers.setIsPromptBoxFocused(true)
    } else if (!computed.isWaitingForInput()) {
      handlers.setIsPromptBoxFocused(false)
    }
  })

  // Single-agent auto-collapse logic
  createEffect(() => {
    const s = state()
    if (s.agents.length === 1) {
      if (!s.timelineCollapsed) {
        debug('[SHELL] Single agent detected, strictly collapsing timeline')
        ui.actions.toggleTimeline()
      }
    }
  })

  // Layout calculations
  const MIN_WIDTH_FOR_SPLIT_VIEW = 100
  const showOutputPanel = () => (dimensions()?.width ?? 80) >= MIN_WIDTH_FOR_SPLIT_VIEW

  // Helper to get monitoring ID for an agent
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
    actions: {
      ...ui.actions,
      toggleTimeline: () => {
        const s = state()
        if (s.agents.length === 1) {
          showToast("warning", "Timeline is locked for single-agent workflows", 3000)
          return
        }
        ui.actions.toggleTimeline()
      }
    },
    calculateVisibleItems: getVisibleItems,
    isModalBlocking: () =>
      computed.isCheckpointActive() ||
      modals.isLogViewerActive() ||
      modals.isHistoryActive() ||
      modals.isHistoryLogViewerActive() ||
      handlers.showStopModal() ||
      events.isErrorModalActive() ||
      handlers.showControllerContinueModal(),
    isPromptBoxFocused: () => handlers.isPromptBoxFocused(),
    isWaitingForInput: computed.isWaitingForInput,
    hasQueuedPrompts: computed.hasQueuedPrompts,
    openLogViewer: modals.setLogViewerAgentId,
    openHistory: () => modals.setShowHistory(true),
    pauseWorkflow: handlers.pauseWorkflow,
    handleSkip: handlers.handleSkip,
    showStopConfirmation: () => handlers.setShowStopModal(true),
    canStop: () => {
      const status = state().workflowStatus
      return status === "running" || status === "paused" || status === "stopping"
    },
    getCurrentAgentId: () => computed.currentAgent()?.id ?? null,
    canFocusPromptBox: () =>
      computed.isWaitingForInput() &&
      (computed.isShowingRunningAgent() || computed.isControllerView()) &&
      !handlers.isPromptBoxFocused(),
    focusPromptBox: () => handlers.setIsPromptBoxFocused(true),
    exitPromptBoxFocus: () => handlers.setIsPromptBoxFocused(false),
    isAutonomousMode: () => state().autonomousMode === 'true' || state().autonomousMode === 'always',
    toggleAutonomousMode: handlers.toggleAutonomousMode,
    showControllerContinue: () => handlers.setShowControllerContinueModal(true),
    hasController: () => !!state().controllerState,
    returnToController: handlers.returnToController
  })

  return {
    // State
    state,
    dimensions,
    timer,

    // Context
    themeCtx,
    ui,

    // Computed
    ...computed,

    // Handlers
    ...handlers,

    // Events
    errorMessage: events.errorMessage,
    setErrorMessage: events.setErrorMessage,
    isErrorModalActive: events.isErrorModalActive,
    handleErrorModalClose: () => events.setErrorMessage(null),

    // Modals
    modals,

    // Log stream
    logStream,

    // Layout helpers
    showOutputPanel,
    getVisibleItems,
    getMonitoringId
  }
}
