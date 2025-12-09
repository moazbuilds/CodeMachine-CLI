/**
 * Workflow Actions
 *
 * Actions for managing workflow status and checkpoint state.
 */

import type { WorkflowState, WorkflowStatus, LoopState, ChainedState, TriggeredAgentState } from "../types"

export type WorkflowActionsContext = {
  getState(): WorkflowState
  setState(state: WorkflowState): void
  notify(): void
}

export function createWorkflowActions(ctx: WorkflowActionsContext) {
  function setWorkflowStatus(status: WorkflowStatus): void {
    const state = ctx.getState()
    if (state.workflowStatus === status) return
    if (status === "completed" || status === "stopped" || status === "stopping") {
      ctx.setState({ ...state, endTime: state.endTime ?? Date.now(), workflowStatus: status })
    } else {
      ctx.setState({ ...state, workflowStatus: status })
    }
    ctx.notify()
  }

  function setCheckpointState(checkpoint: { active: boolean; reason?: string } | null): void {
    const state = ctx.getState()
    ctx.setState({ ...state, checkpointState: checkpoint })
    if (checkpoint && checkpoint.active) {
      setWorkflowStatus("checkpoint")
    } else {
      setWorkflowStatus("running")
    }
    ctx.notify()
  }

  function setChainedState(chainedState: ChainedState | null): void {
    const state = ctx.getState()
    ctx.setState({ ...state, chainedState })
    if (chainedState && chainedState.active) {
      setWorkflowStatus("paused")
    } else {
      setWorkflowStatus("running")
    }
    ctx.notify()
  }

  function setLoopState(loopState: LoopState | null): void {
    let state = ctx.getState()
    state = { ...state, loopState }
    if (loopState && loopState.active) {
      state = {
        ...state,
        agents: state.agents.map((agent) =>
          agent.id === loopState.sourceAgent
            ? { ...agent, loopRound: loopState.iteration, loopReason: loopState.reason }
            : agent,
        ),
      }
    }
    ctx.setState(state)
    ctx.notify()
  }

  function clearLoopRound(agentId: string): void {
    const state = ctx.getState()
    ctx.setState({
      ...state,
      agents: state.agents.map((agent) =>
        agent.id === agentId ? { ...agent, loopRound: undefined, loopReason: undefined } : agent,
      ),
    })
    ctx.notify()
  }

  function addTriggeredAgent(sourceAgentId: string, triggeredAgent: TriggeredAgentState): void {
    const state = ctx.getState()
    ctx.setState({
      ...state,
      triggeredAgents: [...state.triggeredAgents, triggeredAgent],
    })
    ctx.notify()
  }

  function addUIElement(element: { id: string; text: string; stepIndex: number }): void {
    const state = ctx.getState()
    const exists = state.uiElements.some((e) => e.id === element.id || e.stepIndex === element.stepIndex)
    if (exists) return

    ctx.setState({
      ...state,
      uiElements: [...state.uiElements, element],
    })
    ctx.notify()
  }

  function logMessage(agentId: string, message: string): void {
    const state = ctx.getState()
    const newLogs = new Map(state.agentLogs)
    const agentMessages = newLogs.get(agentId) || []
    newLogs.set(agentId, [...agentMessages, message])
    ctx.setState({ ...state, agentLogs: newLogs })
    ctx.notify()
  }

  return {
    setWorkflowStatus,
    setCheckpointState,
    setChainedState,
    setLoopState,
    clearLoopRound,
    addTriggeredAgent,
    addUIElement,
    logMessage,
  }
}
