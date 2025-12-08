/**
 * Sub-Agent Actions
 *
 * Actions for managing sub-agent state.
 */

import type { WorkflowState, AgentStatus, SubAgentState } from "../types"

export type SubAgentActionsContext = {
  getState(): WorkflowState
  setState(state: WorkflowState): void
  notify(): void
}

export function createSubAgentActions(ctx: SubAgentActionsContext) {
  function addSubAgent(parentId: string, subAgent: SubAgentState): void {
    const state = ctx.getState()
    const newSubAgents = new Map(state.subAgents)
    const parentSubAgents = newSubAgents.get(parentId) || []
    const existingIndex = parentSubAgents.findIndex((sa) => sa.id === subAgent.id)
    if (existingIndex >= 0) {
      parentSubAgents[existingIndex] = subAgent
    } else {
      parentSubAgents.push(subAgent)
    }
    newSubAgents.set(parentId, parentSubAgents)
    ctx.setState({ ...state, subAgents: newSubAgents })
    ctx.notify()
  }

  function batchAddSubAgents(parentId: string, subAgents: SubAgentState[]): void {
    if (subAgents.length === 0) return
    const state = ctx.getState()
    const newSubAgents = new Map(state.subAgents)
    const parentSubAgents = newSubAgents.get(parentId) || []
    for (const subAgent of subAgents) {
      const existingIndex = parentSubAgents.findIndex((sa) => sa.id === subAgent.id)
      if (existingIndex >= 0) {
        parentSubAgents[existingIndex] = subAgent
      } else {
        parentSubAgents.push(subAgent)
      }
    }
    newSubAgents.set(parentId, parentSubAgents)
    ctx.setState({ ...state, subAgents: newSubAgents })
    ctx.notify()
  }

  function updateSubAgentStatus(subAgentId: string, status: AgentStatus): void {
    const state = ctx.getState()
    const newSubAgents = new Map(state.subAgents)
    let updated = false
    const shouldSetEndTime = status === "completed" || status === "failed" || status === "skipped"
    for (const [parentId, subAgents] of newSubAgents.entries()) {
      const index = subAgents.findIndex((sa) => sa.id === subAgentId)
      if (index >= 0) {
        const updatedSubAgents = [...subAgents]
        updatedSubAgents[index] = {
          ...updatedSubAgents[index],
          status,
          endTime: shouldSetEndTime ? Date.now() : updatedSubAgents[index].endTime,
        }
        newSubAgents.set(parentId, updatedSubAgents)
        updated = true
        break
      }
    }
    if (updated) {
      ctx.setState({ ...state, subAgents: newSubAgents })
      ctx.notify()
    }
  }

  function clearSubAgents(parentId: string): void {
    const state = ctx.getState()
    const newSubAgents = new Map(state.subAgents)
    newSubAgents.delete(parentId)
    ctx.setState({ ...state, subAgents: newSubAgents })
    ctx.notify()
  }

  return {
    addSubAgent,
    batchAddSubAgents,
    updateSubAgentStatus,
    clearSubAgents,
  }
}
