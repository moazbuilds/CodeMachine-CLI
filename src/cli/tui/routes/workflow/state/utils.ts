import type { AgentState, AgentStatus, AgentTelemetry } from "./types"

export function updateAgentTelemetryInList(
  agents: AgentState[],
  agentId: string,
  telemetry: Partial<AgentTelemetry>
): AgentState[] {
  return agents.map((agent) =>
    agent.id === agentId
      ? {
          ...agent,
          telemetry: {
            tokensIn: telemetry.tokensIn ?? agent.telemetry.tokensIn,
            tokensOut: agent.telemetry.tokensOut + (telemetry.tokensOut ?? 0),
            cached: Math.max(agent.telemetry.cached ?? 0, telemetry.cached ?? 0) || undefined,
            cost: (agent.telemetry.cost ?? 0) + (telemetry.cost ?? 0) || undefined,
            duration: telemetry.duration ?? agent.telemetry.duration,
          },
        }
      : agent,
  )
}

export function updateAgentStatusInList(
  agents: AgentState[],
  agentId: string,
  status: AgentStatus
): AgentState[] {
  return agents.map((agent) =>
    agent.id === agentId
      ? {
          ...agent,
          status,
          endTime: status === "completed" ? Date.now() : agent.endTime,
        }
      : agent,
  )
}
