/**
 * UI State Store
 *
 * Creates a SINGLETON store with all actions composed together.
 * The singleton pattern ensures only one store instance exists,
 * preventing dual-instance bugs where telemetry shows incorrect values.
 */

import type { WorkflowState, Listener, UIActions } from "./types"
import { createInitialState } from "./initial-state"
import { createAgentActions } from "./actions/agent-actions"
import { createSubAgentActions } from "./actions/subagent-actions"
import { createNavigationActions } from "./actions/navigation-actions"
import { createWorkflowActions } from "./actions/workflow-actions"
import { createHistoryActions } from "./actions/history-actions"
import { debug } from "../../../../../../shared/logging/logger.js"

const THROTTLE_MS = 16

// Singleton store instance
let singletonStore: (UIActions & { reset: (workflowName: string) => void }) | null = null

function createStoreInternal(workflowName: string): UIActions & { reset: (workflowName: string) => void } {
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

  // Reset function to reinitialize state for a new workflow
  const reset = (newWorkflowName: string) => {
    debug('[UI-STORE] Resetting store for new workflow: %s', newWorkflowName)
    // Preserve controller state across workflow reset
    const preservedControllerState = state.controllerState
    state = createInitialState(newWorkflowName)
    if (preservedControllerState) {
      debug('[UI-STORE] Preserving controller state: %s', preservedControllerState.id)
      state.controllerState = preservedControllerState
    }
    notifyImmediate()
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
    reset,
    ...agentActions,
    ...subAgentActions,
    ...navigationActions,
    ...workflowActions,
    ...historyActions,
  }
}

/**
 * Get or create the singleton store instance.
 * If the store already exists, it will be reused (preserving state).
 * Call store.reset(workflowName) to reinitialize for a new workflow.
 */
export function createStore(workflowName: string): UIActions & { reset: (workflowName: string) => void } {
  if (!singletonStore) {
    debug('[UI-STORE] Creating singleton store instance')
    singletonStore = createStoreInternal(workflowName)
  } else {
    debug('[UI-STORE] Reusing existing singleton store instance')
  }
  return singletonStore
}

/**
 * Reset the singleton store for a new workflow.
 * This should be called when starting a new workflow to clear old state.
 */
export function resetStore(workflowName: string): void {
  if (singletonStore) {
    singletonStore.reset(workflowName)
  }
}
