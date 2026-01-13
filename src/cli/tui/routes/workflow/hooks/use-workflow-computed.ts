/**
 * Workflow Computed Hook
 *
 * Provides memoized/derived state values for the workflow shell.
 */

import { createMemo, type Accessor } from "solid-js"
import { debug } from "../../../../../shared/logging/logger.js"
import type { WorkflowState, AgentState, SubAgentState } from "../state/types"

export interface UseWorkflowComputedOptions {
  getState: Accessor<WorkflowState>
}

export interface TotalTelemetry {
  tokensIn: number
  tokensOut: number
  cached?: number
}

export interface UseWorkflowComputedResult {
  // View checks
  isControllerView: Accessor<boolean>
  isExecutingView: Accessor<boolean>

  // Input state
  isWaitingForInput: Accessor<boolean>
  hasQueuedPrompts: Accessor<boolean>

  // Agent state
  currentAgent: Accessor<AgentState | SubAgentState | null>
  isShowingRunningAgent: Accessor<boolean>

  // Checkpoint
  isCheckpointActive: Accessor<boolean>

  // Telemetry
  totalTelemetry: Accessor<TotalTelemetry>

  // Layout
  isTimelineCollapsed: Accessor<boolean>
}

export function useWorkflowComputed(options: UseWorkflowComputedOptions): UseWorkflowComputedResult {
  const { getState } = options

  // View checks
  const isControllerView = () => getState().view === 'controller'
  const isExecutingView = () => getState().view === 'executing'

  // Input state
  const isWaitingForInput = () => getState().inputState?.active ?? false

  const hasQueuedPrompts = (): boolean => {
    const inputSt = getState().inputState
    return !!(inputSt?.queuedPrompts && inputSt.queuedPrompts.length > 0)
  }

  // Current agent for output
  const currentAgent = createMemo((): AgentState | SubAgentState | null => {
    const s = getState()

    // In controller view, there are no step agents
    if (s.view === 'controller') {
      return null
    }

    if (s.selectedItemType === "sub" && s.selectedSubAgentId) {
      for (const subAgents of s.subAgents.values()) {
        const found = subAgents.find((sa) => sa.id === s.selectedSubAgentId)
        if (found) return found
      }
    }

    if (s.selectedAgentId) {
      return s.agents.find((a) => a.id === s.selectedAgentId) ?? null
    }

    // Check for running, delegated, or awaiting agents
    const active = s.agents.find((a) =>
      a.status === "running" || a.status === "delegated" || a.status === "awaiting"
    )
    if (active) return active

    return s.agents[s.agents.length - 1] ?? null
  })

  // Check if output window is showing the active agent
  const isShowingRunningAgent = createMemo(() => {
    const s = getState()
    const active = s.agents.find((a) =>
      a.status === "running" || a.status === "delegated" || a.status === "awaiting"
    )
    if (!active) return false
    if (!s.selectedAgentId) return true
    return s.selectedAgentId === active.id && s.selectedItemType !== "sub"
  })

  // Checkpoint state
  const isCheckpointActive = () => getState().checkpointState?.active ?? false

  // Total telemetry - memoized
  const totalTelemetry = createMemo((prev: TotalTelemetry | undefined) => {
    const agents = getState().agents
    const subAgents = getState().subAgents
    const controller = getState().controllerState
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

    const result: TotalTelemetry = {
      tokensIn,
      tokensOut,
      cached: cached > 0 ? cached : undefined
    }

    // Only log when values actually change
    if (!prev || prev.tokensIn !== tokensIn || prev.tokensOut !== tokensOut || prev.cached !== result.cached) {
      debug('[TELEMETRY:6-TOTAL] totalTokensIn=%d, totalTokensOut=%d, totalCached=%s',
        tokensIn, tokensOut, result.cached)
    }

    return result
  })

  // Timeline collapsed state
  const isTimelineCollapsed = () => getState().timelineCollapsed

  return {
    isControllerView,
    isExecutingView,
    isWaitingForInput,
    hasQueuedPrompts,
    currentAgent,
    isShowingRunningAgent,
    isCheckpointActive,
    totalTelemetry,
    isTimelineCollapsed
  }
}
