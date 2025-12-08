/**
 * Workflow Keyboard Hook
 *
 * Handles keyboard navigation for the workflow view.
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
  }
  /** Calculate visible items for navigation */
  calculateVisibleItems: () => number
  /** Check if keyboard should be disabled */
  isDisabled: () => boolean
  /** Open log viewer for an agent */
  openLogViewer: (agentId: string) => void
  /** Open history view */
  openHistory: () => void
  /** Pause workflow */
  pauseWorkflow: () => void
  /** Get current agent ID shown in output window (fallback for Enter key) */
  getCurrentAgentId?: () => string | null
}

/**
 * Hook for workflow keyboard navigation
 */
export function useWorkflowKeyboard(options: UseWorkflowKeyboardOptions) {
  useKeyboard((evt) => {
    if (options.isDisabled()) return

    // H key - toggle history view
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

    // Ctrl+S - skip current agent
    if (evt.ctrl && evt.name === "s") {
      evt.preventDefault()
      ;(process as NodeJS.EventEmitter).emit("workflow:skip")
      return
    }
  })
}
