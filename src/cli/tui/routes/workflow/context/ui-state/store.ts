/**
 * UI State Store
 *
 * Creates the store with all actions composed together.
 */

import type { WorkflowState, Listener, UIActions } from "./types"
import { createInitialState } from "./initial-state"
import { createAgentActions } from "./actions/agent-actions"
import { createSubAgentActions } from "./actions/subagent-actions"
import { createNavigationActions } from "./actions/navigation-actions"
import { createWorkflowActions } from "./actions/workflow-actions"
import { createHistoryActions } from "./actions/history-actions"

const THROTTLE_MS = 16

export function createStore(workflowName: string): UIActions {
  let state = createInitialState(workflowName)
  const listeners = new Set<Listener>()
  let pending: NodeJS.Timeout | null = null

  const notify = () => {
    if (pending) return
    pending = setTimeout(() => {
      pending = null
      listeners.forEach((l) => l())
    }, THROTTLE_MS)
  }

  const notifyImmediate = () => {
    if (pending) {
      clearTimeout(pending)
      pending = null
    }
    listeners.forEach((l) => l())
  }

  const getState = () => state
  const setState = (newState: WorkflowState) => { state = newState }
  const subscribe = (fn: Listener) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  // Create navigation actions first (needed by agent actions)
  const navigationActions = createNavigationActions({
    getState,
    setState,
    notify,
    notifyImmediate,
  })

  // Create agent actions with selectItem from navigation
  const agentActions = createAgentActions({
    getState,
    setState,
    notify,
    notifyImmediate,
    selectItem: navigationActions.selectItem,
  })

  const subAgentActions = createSubAgentActions({
    getState,
    setState,
    notify,
  })

  const workflowActions = createWorkflowActions({
    getState,
    setState,
    notify,
  })

  const historyActions = createHistoryActions({
    getState,
    setState,
    notify,
  })

  return {
    getState,
    subscribe,
    ...agentActions,
    ...subAgentActions,
    ...navigationActions,
    ...workflowActions,
    ...historyActions,
  }
}
