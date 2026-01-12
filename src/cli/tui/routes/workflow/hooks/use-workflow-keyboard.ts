/**
 * Workflow Keyboard Hook
 *
 * Handles keyboard navigation for the workflow view.
 * Global shortcuts (Ctrl+S) always work regardless of modal/focus state.
 */

import { useKeyboard } from "@opentui/solid"
import { debug } from "../../../../../shared/logging/logger.js"
import type { WorkflowState } from "../context/ui-state"

export interface UseWorkflowKeyboardOptions {
  /** Get current workflow state */
  getState: () => WorkflowState
  /** UI actions for navigation */
  actions: {
    navigateUp: (visibleItemCount?: number) => void
    navigateDown: (visibleItemCount?: number) => void
    toggleExpand: (agentId: string) => void
    toggleTimeline: () => void
  }
  /** Calculate visible items for navigation */
  calculateVisibleItems: () => number
  /** Check if a modal is blocking (checkpoint, stop, log viewer, history) */
  isModalBlocking: () => boolean
  /** Check if prompt box is focused */
  isPromptBoxFocused: () => boolean
  /** Check if workflow is waiting for user input (unified pause/chained) */
  isWaitingForInput: () => boolean
  /** Check if there are queued prompts (chained mode) */
  hasQueuedPrompts: () => boolean
  /** Open log viewer for an agent */
  openLogViewer: (agentId: string) => void
  /** Open history view */
  openHistory: () => void
  /** Pause workflow (aborts current step) */
  pauseWorkflow: () => void
  /** Skip remaining prompts */
  handleSkip: () => void
  /** Show stop confirmation modal */
  showStopConfirmation: () => void
  /** Check if workflow can be stopped */
  canStop: () => boolean
  /** Get current agent ID shown in output window (fallback for Enter key) */
  getCurrentAgentId?: () => string | null
  /** Check if prompt box can be focused (input waiting active) */
  canFocusPromptBox?: () => boolean
  /** Focus the prompt box */
  focusPromptBox?: () => void
  /** Exit prompt box focus */
  exitPromptBoxFocus?: () => void
  /** Check if autonomous mode is enabled */
  isAutonomousMode?: () => boolean
  /** Toggle autonomous mode on/off */
  toggleAutonomousMode?: () => void
  /** Check if controller agent is currently active */
  isControllerActive?: () => boolean
  /** Show transition confirmation modal (controller -> workflow) */
  showTransitionConfirmation?: () => void
}

/**
 * Hook for workflow keyboard navigation
 */
export function useWorkflowKeyboard(options: UseWorkflowKeyboardOptions) {
  useKeyboard((evt) => {
    // Log all keyboard events to debug file
    debug('Key event: %s', JSON.stringify({ name: evt.name, shift: evt.shift, ctrl: evt.ctrl, meta: evt.meta }))

    // === GLOBAL SHORTCUTS (always work) ===

    // Shift+Enter - Finish controller conversation (show transition modal)
    if (evt.shift && evt.name === "return") {
      if (options.isControllerActive?.()) {
        evt.preventDefault()
        debug('Shift+Enter pressed in controller step - showing transition modal')
        options.showTransitionConfirmation?.()
        return
      }
    }

    // Shift+Tab - toggle autonomous mode
    if (evt.shift && evt.name === "tab") {
      evt.preventDefault()
      debug('Shift+Tab pressed - toggling autonomous mode')
      debug('Current isAutonomousMode: %s', options.isAutonomousMode?.())
      options.toggleAutonomousMode?.()
      return
    }

    // Ctrl+S - skip (ALWAYS available)
    // When waiting for input: skip remaining prompts
    // When running: skip current agent
    if (evt.ctrl && evt.name === "s") {
      evt.preventDefault()

      // If waiting for input (paused or chained), skip remaining prompts
      if (options.isWaitingForInput()) {
        options.handleSkip()
        options.exitPromptBoxFocus?.()
        return
      }

      // Normal case: skip current agent
      ;(process as NodeJS.EventEmitter).emit("workflow:skip")
      return
    }

    // Tab key - toggle timeline panel (GLOBAL - works even in prompt box)
    if (evt.name === "tab") {
      evt.preventDefault()
      options.actions.toggleTimeline()
      return
    }

    // === PROMPT BOX FOCUSED STATE ===
    // When prompt box is focused, only handle Escape (to exit focus)
    // Other keys should pass through to the input component
    if (options.isPromptBoxFocused()) {
      if (evt.name === "escape") {
        evt.preventDefault()
        options.exitPromptBoxFocus?.()
      }
      // Don't handle other keys - let the input handle them
      return
    }

    // === MODAL BLOCKING STATE ===
    // When a modal is open (checkpoint, stop, log viewer, history),
    // let the modal handle its own keyboard events
    if (options.isModalBlocking()) {
      return
    }

    // === CONTROLLER MODE ===
    // When controller is active, limited shortcuts available
    // Tab is handled above in global shortcuts
    if (options.isControllerActive?.()) {
      // Right arrow - re-focus prompt box (if unfocused)
      if (evt.name === "right") {
        if (options.canFocusPromptBox?.()) {
          evt.preventDefault()
          options.focusPromptBox?.()
          return
        }
      }

      // Esc - show stop confirmation (only when prompt box is NOT focused)
      // When prompt box is focused, Esc just exits focus (handled above)
      if (evt.name === "escape" && options.canStop() && !options.isPromptBoxFocused()) {
        evt.preventDefault()
        options.showStopConfirmation()
        return
      }

      // P key - pause workflow (useful to see what controller is doing)
      if (evt.name === "p") {
        evt.preventDefault()
        options.pauseWorkflow()
        return
      }

      // H key - open history view
      if (evt.name === "h") {
        evt.preventDefault()
        options.openHistory()
        return
      }

      // Block all other shortcuts in controller mode
      return
    }

    // === NORMAL WORKFLOW SHORTCUTS ===

    // H key - open history view
    if (evt.name === "h") {
      evt.preventDefault()
      options.openHistory()
      return
    }

    // P key - pause workflow
    if (evt.name === "p") {
      evt.preventDefault()
      options.pauseWorkflow()
      return
    }

    // Arrow up - navigate to previous item
    if (evt.name === "up") {
      evt.preventDefault()
      options.actions.navigateUp(options.calculateVisibleItems())
      return
    }

    // Arrow down - navigate to next item
    if (evt.name === "down") {
      evt.preventDefault()
      options.actions.navigateDown(options.calculateVisibleItems())
      return
    }

    // Right arrow - focus prompt box (when chaining/paused active)
    if (evt.name === "right") {
      if (options.canFocusPromptBox?.()) {
        evt.preventDefault()
        options.focusPromptBox?.()
        return
      }
    }

    // Enter key has dual functionality
    if (evt.name === "return") {
      evt.preventDefault()
      const s = options.getState()
      if (s.selectedItemType === "summary" && s.selectedAgentId) {
        options.actions.toggleExpand(s.selectedAgentId)
      } else {
        // Use selected agent, or fall back to current agent in output window
        const agentId = s.selectedSubAgentId || s.selectedAgentId || options.getCurrentAgentId?.()
        if (agentId) {
          options.openLogViewer(agentId)
        }
      }
      return
    }

    // Space - toggle expand on selected agent
    if (evt.name === "space") {
      evt.preventDefault()
      const s = options.getState()
      if (s.selectedAgentId && (s.selectedItemType === "main" || s.selectedItemType === "summary")) {
        options.actions.toggleExpand(s.selectedAgentId)
      }
      return
    }

    // Escape key - show stop confirmation (only if workflow can be stopped)
    if (evt.name === "escape" && options.canStop()) {
      evt.preventDefault()
      options.showStopConfirmation()
      return
    }
  })
}
