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

/** Check if a sub-agent status means it's still active (not done) */
function isActiveStatus(status: AgentStatus): boolean {
  return status === "running" || status === "delegated" || status === "awaiting" || status === "pending" || status === "retrying"
}

/** Check if all sub-agents for a parent are done (no active ones) */
function allSubAgentsDone(subAgents: SubAgentState[]): boolean {
  return subAgents.length > 0 && subAgents.every(sa => !isActiveStatus(sa.status))
}

export function createSubAgentActions(ctx: SubAgentActionsContext) {
  function addSubAgent(parentId: string, subAgent: SubAgentState): void {
    const state = ctx.getState()
    const newSubAgents = new Map(state.subAgents)
    const parentSubAgents = newSubAgents.get(parentId) || []
    const isFirstSubAgent = parentSubAgents.length === 0
    const existingIndex = parentSubAgents.findIndex((sa) => sa.id === subAgent.id)
    if (existingIndex >= 0) {
      parentSubAgents[existingIndex] = subAgent
    } else {
      parentSubAgents.push(subAgent)
    }
    newSubAgents.set(parentId, parentSubAgents)

    // Auto-expand when first sub-agent is added
    let expandedNodes = state.expandedNodes
    if (isFirstSubAgent && !expandedNodes.has(parentId)) {
      expandedNodes = new Set(expandedNodes)
      expandedNodes.add(parentId)
    }

    ctx.setState({ ...state, subAgents: newSubAgents, expandedNodes })
    ctx.notify()
  }

  function batchAddSubAgents(parentId: string, subAgents: SubAgentState[]): void {
    if (subAgents.length === 0) return
    const state = ctx.getState()
    const newSubAgents = new Map(state.subAgents)
    const parentSubAgents = newSubAgents.get(parentId) || []
    const isFirstSubAgent = parentSubAgents.length === 0
    for (const subAgent of subAgents) {
      const existingIndex = parentSubAgents.findIndex((sa) => sa.id === subAgent.id)
      if (existingIndex >= 0) {
        parentSubAgents[existingIndex] = subAgent
      } else {
        parentSubAgents.push(subAgent)
      }
    }
    newSubAgents.set(parentId, parentSubAgents)

    // Auto-expand when first sub-agents are added
    let expandedNodes = state.expandedNodes
    if (isFirstSubAgent && !expandedNodes.has(parentId)) {
      expandedNodes = new Set(expandedNodes)
      expandedNodes.add(parentId)
    }

    ctx.setState({ ...state, subAgents: newSubAgents, expandedNodes })
    ctx.notify()
  }

  function updateSubAgentStatus(subAgentId: string, status: AgentStatus): void {
    const state = ctx.getState()
    const newSubAgents = new Map(state.subAgents)
    for (const [parentId, subAgents] of newSubAgents.entries()) {
      const index = subAgents.findIndex((sa) => sa.id === subAgentId)
      if (index >= 0) {
        const updatedSubAgents = [...subAgents]
        updatedSubAgents[index] = { ...updatedSubAgents[index], status }
        newSubAgents.set(parentId, updatedSubAgents)

        // Auto-collapse when all sub-agents are done
        let expandedNodes = state.expandedNodes
        if (allSubAgentsDone(updatedSubAgents) && expandedNodes.has(parentId)) {
          expandedNodes = new Set(expandedNodes)
          expandedNodes.delete(parentId)
        }

        ctx.setState({ ...state, subAgents: newSubAgents, expandedNodes })
        ctx.notify()
        return
      }
    }
  }

  function updateSubAgentStartTime(subAgentId: string, startTime: number): void {
    const state = ctx.getState()
    const newSubAgents = new Map(state.subAgents)
    for (const [parentId, subAgents] of newSubAgents.entries()) {
      const index = subAgents.findIndex((sa) => sa.id === subAgentId)
      if (index >= 0) {
        const updatedSubAgents = [...subAgents]
        updatedSubAgents[index] = { ...updatedSubAgents[index], startTime }
        newSubAgents.set(parentId, updatedSubAgents)
        ctx.setState({ ...state, subAgents: newSubAgents })
        ctx.notify()
        return
      }
    }
  }

  function updateSubAgentDuration(subAgentId: string, duration: number): void {
    const state = ctx.getState()
    const newSubAgents = new Map(state.subAgents)
    for (const [parentId, subAgents] of newSubAgents.entries()) {
      const index = subAgents.findIndex((sa) => sa.id === subAgentId)
      if (index >= 0) {
        const updatedSubAgents = [...subAgents]
        updatedSubAgents[index] = { ...updatedSubAgents[index], duration, endTime: Date.now() }
        newSubAgents.set(parentId, updatedSubAgents)
        ctx.setState({ ...state, subAgents: newSubAgents })
        ctx.notify()
        return
      }
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
    updateSubAgentStartTime,
    updateSubAgentDuration,
    clearSubAgents,
  }
}
