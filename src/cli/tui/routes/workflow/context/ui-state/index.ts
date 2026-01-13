/**
 * UI State Module
 *
 * Exports the provider, hook, and types for UI state management.
 * Uses a singleton store to prevent dual-instance bugs.
 */

export { UIStateProvider, useUIState } from "./provider"
export { resetStore } from "./store"
export type { UIActions, WorkflowState, AgentStatus, WorkflowStatus } from "./types"
