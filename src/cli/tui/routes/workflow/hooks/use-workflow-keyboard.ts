/**
 * Workflow Keyboard Hook
 *
 * Handles keyboard navigation for the workflow view.
 * Global shortcuts (Ctrl+S) always work regardless of modal/focus state.
 */

import { useKeyboard } from "@opentui/solid"
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
  /** Check if chained prompts are active */
  isChainedActive: () => boolean
  /** Check if workflow is paused */
  isPaused: () => boolean
  /** Resume workflow (used when skipping while paused) */
  resumeWorkflow: () => void
  /** Open log viewer for an agent */
  openLogViewer: (agentId: string) => void
  /** Open history view */
  openHistory: () => void
  /** Pause workflow */
  pauseWorkflow: () => void
  /** Show stop confirmation modal */
  showStopConfirmation: () => void
  /** Check if workflow can be stopped */
  canStop: () => boolean
  /** Get current agent ID shown in output window (fallback for Enter key) */
  getCurrentAgentId?: () => string | null
  /** Check if prompt box can be focused (chaining/paused active) */
  canFocusPromptBox?: () => boolean
  /** Focus the prompt box */
  focusPromptBox?: () => void
  /** Exit prompt box focus */
  exitPromptBoxFocus?: () => void
}

/**
 * Hook for workflow keyboard navigation
 */
export function useWorkflowKeyboard(options: UseWorkflowKeyboardOptions) {
  useKeyboard((evt) => {
    // === GLOBAL SHORTCUTS (always work) ===

    // Ctrl+S - skip current agent (ALWAYS available)
    // Handles different states: chained prompts, paused, or running
    if (evt.ctrl && evt.name === "s") {
      evt.preventDefault()

      // If chained prompts active, skip all remaining chained prompts
      if (options.isChainedActive()) {
        ;(process as NodeJS.EventEmitter).emit("chained:skip-all")
        options.exitPromptBoxFocus?.()
        return
      }

      // If paused, resume first then skip
      if (options.isPaused()) {
        options.resumeWorkflow()
        options.exitPromptBoxFocus?.()
        // Small delay to let resume take effect, then skip
        setTimeout(() => {
          ;(process as NodeJS.EventEmitter).emit("workflow:skip")
        }, 50)
        return
      }

      // Normal case: just emit skip
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
