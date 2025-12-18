/**
 * Agent Actions
 *
 * Actions for managing main agent state.
 */

import type { WorkflowState, AgentStatus } from "../types"

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

    // Auto-select if this agent is running or initializing (handles resume case)
    if (agent.status === "running" || agent.status === "initializing") {
      ctx.selectItem(agent.id, "main", undefined, true)
    }

    ctx.notify()
  }

  function updateAgentStatus(agentId: string, status: AgentStatus): void {
    const state = ctx.getState()
    const shouldSetEndTime = status === "completed" || status === "failed" || status === "skipped"
    ctx.setState({
      ...state,
      agents: state.agents.map((agent) => {
        if (agent.id !== agentId) return agent

        // Only set startTime on FIRST "running" or "initializing" transition (prevents timer reset on resume/step transitions)
        const shouldSetStartTime = (status === "running" || status === "initializing") && !agent.startTime

        return {
          ...agent,
          status,
          startTime: shouldSetStartTime ? Date.now() : agent.startTime,
          endTime: shouldSetEndTime ? Date.now() : agent.endTime,
        }
      }),
    })
    if (status === "running" || status === "initializing") {
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

    // Update telemetry and also set baseDuration if duration is provided for an unstarted agent (resume case)
    const updatedAgents = state.agents.map((agent) => {
      if (agent.id !== agentId) return agent

      const updatedTelemetry = {
        tokensIn: agent.telemetry.tokensIn + (telemetry.tokensIn ?? 0),
        tokensOut: agent.telemetry.tokensOut + (telemetry.tokensOut ?? 0),
        cached: (agent.telemetry.cached ?? 0) + (telemetry.cached ?? 0) || undefined,
        cost: (agent.telemetry.cost ?? 0) + (telemetry.cost ?? 0) || undefined,
        duration: (agent.telemetry.duration ?? 0) + (telemetry.duration ?? 0) || undefined,
      }

      // Store duration as baseDuration if not already set (resume case)
      // Note: We check baseDuration instead of startTime because status events
      // are emitted before telemetry events, so startTime is already set
      const baseDuration = telemetry.duration !== undefined && !agent.baseDuration
        ? telemetry.duration
        : agent.baseDuration

      return { ...agent, telemetry: updatedTelemetry, baseDuration }
    })

    ctx.setState({ ...state, agents: updatedAgents })
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
