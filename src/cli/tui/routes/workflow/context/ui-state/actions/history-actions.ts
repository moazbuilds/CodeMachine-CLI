/**
 * History Actions
 *
 * Actions for managing execution history and loop resets.
 */

import type { WorkflowState, AgentStatus } from "../types"

export type HistoryActionsContext = {
  getState(): WorkflowState
  setState(state: WorkflowState): void
  notify(): void
}

export function createHistoryActions(ctx: HistoryActionsContext) {
  function resetAgentForLoop(agentId: string, cycleNumber?: number): void {
    const state = ctx.getState()
    const agent = state.agents.find((a) => a.id === agentId)
    if (!agent) return

    // Save current state to execution history before reset
    const historyRecord = {
      id: `${agentId}-cycle-${cycleNumber ?? 0}-${Date.now()}`,
      agentName: agent.name,
      agentId: agent.id,
      cycleNumber,
      engine: agent.engine,
      status: agent.status,
      startTime: agent.startTime,
      endTime: agent.endTime,
      duration: agent.endTime ? agent.endTime - agent.startTime : undefined,
      telemetry: { ...agent.telemetry },
      toolCount: agent.toolCount,
      thinkingCount: agent.thinkingCount,
      error: agent.error,
    }

    // Reset agent state for new loop iteration
    let newState = {
      ...state,
      agents: state.agents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              status: "pending" as AgentStatus,
              telemetry: { tokensIn: 0, tokensOut: 0 },
              toolCount: 0,
              thinkingCount: 0,
              startTime: Date.now(),
              endTime: undefined,
              error: undefined,
            }
          : a,
      ),
      executionHistory: [...state.executionHistory, historyRecord],
    }

    // Clear sub-agents for this agent
    const newSubAgents = new Map(newState.subAgents)
    newSubAgents.delete(agentId)
    newState = { ...newState, subAgents: newSubAgents }

    ctx.setState(newState)
    ctx.notify()
  }

  return {
    resetAgentForLoop,
  }
}
