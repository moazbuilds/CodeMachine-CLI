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
          telemetry: { ...agent.telemetry, ...telemetry },
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
