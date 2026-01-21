import type { AgentState, AgentStatus, AgentTelemetry, ControllerState } from "./types"
import { debug } from "../../../../../shared/logging/logger.js"

export function updateAgentTelemetryInList(
  agents: AgentState[],
  agentId: string,
  telemetry: Partial<AgentTelemetry>
): AgentState[] {
  return agents.map((agent) => {
    if (agent.id !== agentId) return agent

    // Context = input tokens (total)
    // Note: cached tokens are already INCLUDED in tokensIn, not separate
    // cached is just metadata showing how many of those tokens were served from cache
    const currentContext = telemetry.tokensIn ?? 0
    const newTokensIn = currentContext > 0 ? currentContext : agent.telemetry.tokensIn
    const newTokensOut = telemetry.tokensOut ?? agent.telemetry.tokensOut
    const newCached = telemetry.cached ?? agent.telemetry.cached
    // Cost accumulates
    const newCost = (agent.telemetry.cost ?? 0) + (telemetry.cost ?? 0) || undefined

    debug('[TELEMETRY:5-UTILS] [STEP-AGENT] updateAgentTelemetryInList → agentId=%s', agentId)
    debug('[TELEMETRY:5-UTILS] [STEP-AGENT]   INPUT: context=%d (cached=%d), output=%d',
      telemetry.tokensIn ?? 0, telemetry.cached ?? 0, telemetry.tokensOut ?? 0)
    debug('[TELEMETRY:5-UTILS] [STEP-AGENT]   RESULT: context=%d, output=%d (REPLACES previous)',
      newTokensIn, newTokensOut)

    return {
      ...agent,
      telemetry: {
        tokensIn: newTokensIn,
        tokensOut: newTokensOut,
        cached: newCached,
        cost: newCost,
        duration: telemetry.duration ?? agent.telemetry.duration,
      },
    }
  })
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

export function updateControllerTelemetry(
  controller: ControllerState,
  telemetry: Partial<AgentTelemetry>
): ControllerState {
  // Context = input tokens (total)
  // Note: cached tokens are already INCLUDED in tokensIn, not separate
  // cached is just metadata showing how many of those tokens were served from cache
  const currentContext = telemetry.tokensIn ?? 0
  const newTokensIn = currentContext > 0 ? currentContext : controller.telemetry.tokensIn
  const newTokensOut = telemetry.tokensOut ?? controller.telemetry.tokensOut
  const newCached = telemetry.cached ?? controller.telemetry.cached
  // Cost accumulates
  const newCost = (controller.telemetry.cost ?? 0) + (telemetry.cost ?? 0) || undefined

  debug('[TELEMETRY:5-UTILS] [CONTROLLER] updateControllerTelemetry')
  debug('[TELEMETRY:5-UTILS] [CONTROLLER]   INPUT: context=%d (cached=%d), output=%d',
    telemetry.tokensIn ?? 0, telemetry.cached ?? 0, telemetry.tokensOut ?? 0)
  debug('[TELEMETRY:5-UTILS] [CONTROLLER]   RESULT: context=%d, output=%d (REPLACES previous)',
    newTokensIn, newTokensOut)

  return {
    ...controller,
    telemetry: {
      tokensIn: newTokensIn,
      tokensOut: newTokensOut,
      cached: newCached,
      cost: newCost,
      duration: telemetry.duration ?? controller.telemetry.duration,
    },
  }
}
