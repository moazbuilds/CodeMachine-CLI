/**
 * Agent Entity
 *
 * Represents an AI agent that executes workflow steps.
 * Immutable - all modifications return new instances.
 */

import type {
  AgentId,
  SessionId,
  MonitoringId,
  AgentStatus,
  Telemetry,
  EngineName,
} from '../../../shared/types'

// ============================================================================
// Agent Entity
// ============================================================================

export interface Agent {
  readonly id: AgentId
  readonly name: string
  readonly engine: EngineName
  readonly model: string | null
  readonly status: AgentStatus
  readonly stepIndex: number
  readonly sessionId: SessionId | null
  readonly monitoringId: MonitoringId | null
  readonly startedAt: number | null
  readonly completedAt: number | null
  readonly telemetry: Telemetry
  readonly subAgents: SubAgent[]
}

export interface SubAgent {
  readonly id: AgentId
  readonly name: string
  readonly model: string | null
  readonly status: AgentStatus
  readonly parentId: AgentId
  readonly startedAt: number | null
  readonly completedAt: number | null
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createAgent = (
  id: AgentId,
  name: string,
  engine: EngineName,
  stepIndex: number,
  model?: string
): Agent => ({
  id,
  name,
  engine,
  model: model ?? null,
  status: 'pending',
  stepIndex,
  sessionId: null,
  monitoringId: null,
  startedAt: null,
  completedAt: null,
  telemetry: { tokensIn: 0, tokensOut: 0, cost: 0 },
  subAgents: [],
})

export const createSubAgent = (
  id: AgentId,
  name: string,
  parentId: AgentId,
  model?: string
): SubAgent => ({
  id,
  name,
  model: model ?? null,
  status: 'pending',
  parentId,
  startedAt: null,
  completedAt: null,
})

// ============================================================================
// Agent Operations (Immutable)
// ============================================================================

export const agentOps = {
  start: (agent: Agent, now: number = Date.now()): Agent => ({
    ...agent,
    status: 'running',
    startedAt: now,
  }),

  setSession: (
    agent: Agent,
    sessionId: SessionId,
    monitoringId: MonitoringId
  ): Agent => ({
    ...agent,
    sessionId,
    monitoringId,
  }),

  setWaiting: (agent: Agent): Agent => ({
    ...agent,
    status: 'waiting',
  }),

  complete: (agent: Agent, now: number = Date.now()): Agent => ({
    ...agent,
    status: 'completed',
    completedAt: now,
  }),

  setError: (agent: Agent): Agent => ({
    ...agent,
    status: 'error',
  }),

  skip: (agent: Agent, now: number = Date.now()): Agent => ({
    ...agent,
    status: 'skipped',
    completedAt: now,
  }),

  addTelemetry: (agent: Agent, telemetry: Partial<Telemetry>): Agent => ({
    ...agent,
    telemetry: {
      tokensIn: agent.telemetry.tokensIn + (telemetry.tokensIn ?? 0),
      tokensOut: agent.telemetry.tokensOut + (telemetry.tokensOut ?? 0),
      cost: agent.telemetry.cost + (telemetry.cost ?? 0),
      cached: (agent.telemetry.cached ?? 0) + (telemetry.cached ?? 0),
    },
  }),

  addSubAgent: (agent: Agent, subAgent: SubAgent): Agent => ({
    ...agent,
    subAgents: [...agent.subAgents, subAgent],
  }),

  updateSubAgent: (agent: Agent, subAgentId: AgentId, updates: Partial<SubAgent>): Agent => ({
    ...agent,
    subAgents: agent.subAgents.map(sub =>
      sub.id === subAgentId ? { ...sub, ...updates } : sub
    ),
  }),

  clearSubAgents: (agent: Agent): Agent => ({
    ...agent,
    subAgents: [],
  }),
}

// ============================================================================
// SubAgent Operations (Immutable)
// ============================================================================

export const subAgentOps = {
  start: (subAgent: SubAgent, now: number = Date.now()): SubAgent => ({
    ...subAgent,
    status: 'running',
    startedAt: now,
  }),

  complete: (subAgent: SubAgent, now: number = Date.now()): SubAgent => ({
    ...subAgent,
    status: 'completed',
    completedAt: now,
  }),

  setError: (subAgent: SubAgent): SubAgent => ({
    ...subAgent,
    status: 'error',
  }),
}

// ============================================================================
// Agent Queries
// ============================================================================

export const agentQueries = {
  isRunning: (agent: Agent): boolean =>
    agent.status === 'running',

  isComplete: (agent: Agent): boolean =>
    agent.status === 'completed' || agent.status === 'skipped',

  isWaiting: (agent: Agent): boolean =>
    agent.status === 'waiting',

  hasError: (agent: Agent): boolean =>
    agent.status === 'error',

  getDuration: (agent: Agent, now: number = Date.now()): number => {
    if (!agent.startedAt) return 0
    const endTime = agent.completedAt ?? now
    return endTime - agent.startedAt
  },

  getSubAgentCount: (agent: Agent): number =>
    agent.subAgents.length,

  getActiveSubAgents: (agent: Agent): SubAgent[] =>
    agent.subAgents.filter(sub => sub.status === 'running'),

  getCompletedSubAgents: (agent: Agent): SubAgent[] =>
    agent.subAgents.filter(sub => sub.status === 'completed'),

  getSubAgentById: (agent: Agent, id: AgentId): SubAgent | undefined =>
    agent.subAgents.find(sub => sub.id === id),

  hasSession: (agent: Agent): boolean =>
    agent.sessionId !== null,

  canResume: (agent: Agent): boolean =>
    agent.sessionId !== null &&
    (agent.status === 'waiting' || agent.status === 'error'),
}

// ============================================================================
// Type Guards
// ============================================================================

export const isAgent = (value: unknown): value is Agent => {
  if (!value || typeof value !== 'object') return false
  const a = value as Agent
  return (
    typeof a.id === 'string' &&
    typeof a.name === 'string' &&
    typeof a.engine === 'string' &&
    typeof a.status === 'string'
  )
}

export const isSubAgent = (value: unknown): value is SubAgent => {
  if (!value || typeof value !== 'object') return false
  const s = value as SubAgent
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.parentId === 'string' &&
    typeof s.status === 'string'
  )
}
