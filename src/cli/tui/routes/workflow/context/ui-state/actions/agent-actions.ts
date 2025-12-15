/**
 * Agent Actions
 *
 * Actions for managing main agent state.
 */

import type { WorkflowState, AgentStatus } from "../types"
import { updateAgentTelemetryInList } from "../../../state/utils"

export type AgentActionsContext = {
  getState(): WorkflowState
  setState(state: WorkflowState): void
  notify(): void
  notifyImmediate(): void
  selectItem(itemId: string, itemType: "main" | "summary" | "sub", visibleItemCount?: number, immediate?: boolean): void
}

export function createAgentActions(ctx: AgentActionsContext) {
  function addAgent(agent: WorkflowState["agents"][number]): void {
    const state = ctx.getState()
    ctx.setState({ ...state, agents: [...state.agents, agent] })
    ctx.notify()
  }

  function updateAgentStatus(agentId: string, status: AgentStatus): void {
    const state = ctx.getState()
    const shouldSetEndTime = status === "completed" || status === "failed" || status === "skipped"
    const shouldSetStartTime = status === "running"
    ctx.setState({
      ...state,
      agents: state.agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status,
              startTime: shouldSetStartTime ? Date.now() : agent.startTime,
              endTime: shouldSetEndTime ? Date.now() : agent.endTime,
            }
          : agent,
      ),
    })
    if (status === "running") {
      ctx.selectItem(agentId, "main", undefined, true)
    }
    ctx.notifyImmediate()
  }

  function updateAgentEngine(agentId: string, engine: string): void {
    const state = ctx.getState()
    ctx.setState({
      ...state,
      agents: state.agents.map((agent) =>
        agent.id === agentId ? { ...agent, engine } : agent,
      ),
    })
    ctx.notifyImmediate()
  }

  function updateAgentModel(agentId: string, model: string): void {
    const state = ctx.getState()
    ctx.setState({
      ...state,
      agents: state.agents.map((agent) =>
        agent.id === agentId ? { ...agent, model } : agent,
      ),
    })
    ctx.notifyImmediate()
  }

  function updateAgentTelemetry(
    agentId: string,
    telemetry: Partial<WorkflowState["agents"][number]["telemetry"]>,
  ): void {
    const state = ctx.getState()
    ctx.setState({ ...state, agents: updateAgentTelemetryInList(state.agents, agentId, telemetry) })
    ctx.notify()
  }

  function registerMonitoringId(uiAgentId: string, monitoringId: number): void {
    const state = ctx.getState()
    ctx.setState({
      ...state,
      agents: state.agents.map((agent) =>
        agent.id === uiAgentId ? { ...agent, monitoringId } : agent
      ),
      agentIdMapVersion: state.agentIdMapVersion + 1,
    })
    ctx.notify()
  }

  return {
    addAgent,
    updateAgentStatus,
    updateAgentEngine,
    updateAgentModel,
    updateAgentTelemetry,
    registerMonitoringId,
  }
}
