/**
 * Agent Service
 *
 * Manages agent lifecycle, coordination, and monitoring.
 *
 * Responsibilities:
 * - Create and track agents
 * - Manage agent execution
 * - Track sub-agents
 * - Emit agent events
 * - Handle agent cleanup
 */

import type {
  AgentId,
  SessionId,
  MonitoringId,
  AgentStatus,
  Telemetry,
  EngineName,
  Unsubscribe,
} from '../../shared/types'
import { createScopedLogger, type IStructuredLogger } from '../../shared/logging'
import { AgentNotFoundError, AgentExecutionError } from '../../shared/errors'
import type { IEventBus } from '../../infrastructure/events/event-bus'
import { getEventBus } from '../../infrastructure/events/event-bus'
import {
  Agent,
  SubAgent,
  createAgent,
  createSubAgent,
  agentOps,
  agentQueries,
} from '../../domain/agent/entities/agent'

// ============================================================================
// Types
// ============================================================================

export interface AgentServiceConfig {
  eventBus?: IEventBus
  logger?: IStructuredLogger
}

export interface CreateAgentOptions {
  id: AgentId
  name: string
  engine: EngineName
  stepIndex: number
  model?: string
}

export interface AgentExecutionContext {
  cwd: string
  cmRoot: string
  promptPath: string | string[]
  sessionId?: SessionId
  abortSignal?: AbortSignal
}

export interface AgentExecutionResult {
  output: string
  sessionId: SessionId
  monitoringId: MonitoringId
  telemetry: Telemetry
  duration: number
}

// ============================================================================
// Agent Service Implementation
// ============================================================================

export class AgentService {
  private readonly logger: IStructuredLogger
  private readonly eventBus: IEventBus

  private agents = new Map<AgentId, Agent>()
  private agentsByStep = new Map<number, AgentId>()

  constructor(config: AgentServiceConfig = {}) {
    this.logger = config.logger ?? createScopedLogger('agent-service')
    this.eventBus = config.eventBus ?? getEventBus()
  }

  // ============================================================================
  // Agent Lifecycle
  // ============================================================================

  /**
   * Create a new agent
   */
  createAgent(options: CreateAgentOptions): Agent {
    this.logger.debug('Creating agent', { id: options.id, name: options.name })

    const agent = createAgent(
      options.id,
      options.name,
      options.engine,
      options.stepIndex,
      options.model
    )

    this.agents.set(agent.id, agent)
    this.agentsByStep.set(options.stepIndex, agent.id)

    // Emit agent added event
    this.eventBus.emit({
      type: 'agent:added',
      timestamp: Date.now(),
      agentId: agent.id,
      name: agent.name,
      engine: agent.engine,
      stepIndex: agent.stepIndex,
      totalSteps: 0, // Will be updated by workflow
    })

    return agent
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: AgentId): Agent | undefined {
    return this.agents.get(id)
  }

  /**
   * Get an agent by step index
   */
  getAgentByStep(stepIndex: number): Agent | undefined {
    const agentId = this.agentsByStep.get(stepIndex)
    return agentId ? this.agents.get(agentId) : undefined
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Update agent status
   */
  updateStatus(id: AgentId, status: AgentStatus): Agent {
    const agent = this.agents.get(id)
    if (!agent) {
      throw new AgentNotFoundError(id)
    }

    const previousStatus = agent.status
    let updatedAgent: Agent

    switch (status) {
      case 'running':
        updatedAgent = agentOps.start(agent)
        break
      case 'waiting':
        updatedAgent = agentOps.setWaiting(agent)
        break
      case 'completed':
        updatedAgent = agentOps.complete(agent)
        break
      case 'error':
        updatedAgent = agentOps.setError(agent)
        break
      case 'skipped':
        updatedAgent = agentOps.skip(agent)
        break
      default:
        updatedAgent = { ...agent, status }
    }

    this.agents.set(id, updatedAgent)

    // Emit status change event
    this.eventBus.emit({
      type: 'agent:status-changed',
      timestamp: Date.now(),
      agentId: id,
      previousStatus,
      currentStatus: status,
    })

    return updatedAgent
  }

  /**
   * Set agent session
   */
  setSession(id: AgentId, sessionId: SessionId, monitoringId: MonitoringId): Agent {
    const agent = this.agents.get(id)
    if (!agent) {
      throw new AgentNotFoundError(id)
    }

    const updatedAgent = agentOps.setSession(agent, sessionId, monitoringId)
    this.agents.set(id, updatedAgent)

    // Emit session event
    this.eventBus.emit({
      type: 'agent:session',
      timestamp: Date.now(),
      agentId: id,
      sessionId,
      monitoringId,
    })

    return updatedAgent
  }

  /**
   * Add telemetry to agent
   */
  addTelemetry(id: AgentId, telemetry: Partial<Telemetry>, cumulative = false): Agent {
    const agent = this.agents.get(id)
    if (!agent) {
      throw new AgentNotFoundError(id)
    }

    const updatedAgent = agentOps.addTelemetry(agent, telemetry)
    this.agents.set(id, updatedAgent)

    // Emit telemetry event
    this.eventBus.emit({
      type: 'agent:telemetry',
      timestamp: Date.now(),
      agentId: id,
      telemetry: updatedAgent.telemetry,
      cumulative,
    })

    return updatedAgent
  }

  // ============================================================================
  // Sub-Agent Management
  // ============================================================================

  /**
   * Add a sub-agent
   */
  addSubAgent(
    parentId: AgentId,
    subAgentId: AgentId,
    name: string,
    model?: string
  ): SubAgent {
    const parent = this.agents.get(parentId)
    if (!parent) {
      throw new AgentNotFoundError(parentId)
    }

    const subAgent = createSubAgent(subAgentId, name, parentId, model)
    const updatedParent = agentOps.addSubAgent(parent, subAgent)
    this.agents.set(parentId, updatedParent)

    // Emit sub-agent added event
    this.eventBus.emit({
      type: 'subagent:added',
      timestamp: Date.now(),
      parentAgentId: parentId,
      subAgentId,
      name,
      model,
    })

    return subAgent
  }

  /**
   * Add multiple sub-agents at once
   */
  addSubAgentBatch(
    parentId: AgentId,
    subAgents: Array<{ id: AgentId; name: string; model?: string; status?: AgentStatus }>
  ): void {
    const parent = this.agents.get(parentId)
    if (!parent) {
      throw new AgentNotFoundError(parentId)
    }

    let updatedParent = parent

    const subAgentEntities = subAgents.map(sub => {
      const subAgent = createSubAgent(sub.id, sub.name, parentId, sub.model)
      updatedParent = agentOps.addSubAgent(updatedParent, subAgent)
      return {
        id: sub.id,
        name: sub.name,
        model: sub.model,
        status: sub.status ?? 'pending' as AgentStatus,
      }
    })

    this.agents.set(parentId, updatedParent)

    // Emit batch event
    this.eventBus.emit({
      type: 'subagent:batch',
      timestamp: Date.now(),
      parentAgentId: parentId,
      subAgents: subAgentEntities,
    })
  }

  /**
   * Update sub-agent status
   */
  updateSubAgentStatus(parentId: AgentId, subAgentId: AgentId, status: AgentStatus): void {
    const parent = this.agents.get(parentId)
    if (!parent) {
      throw new AgentNotFoundError(parentId)
    }

    const subAgent = agentQueries.getSubAgentById(parent, subAgentId)
    if (!subAgent) {
      throw new AgentNotFoundError(subAgentId)
    }

    const updatedParent = agentOps.updateSubAgent(parent, subAgentId, { status })
    this.agents.set(parentId, updatedParent)

    // Emit status change event
    this.eventBus.emit({
      type: 'subagent:status-changed',
      timestamp: Date.now(),
      parentAgentId: parentId,
      subAgentId,
      status,
    })
  }

  /**
   * Clear sub-agents for a parent
   */
  clearSubAgents(parentId: AgentId): void {
    const parent = this.agents.get(parentId)
    if (!parent) {
      return
    }

    const updatedParent = agentOps.clearSubAgents(parent)
    this.agents.set(parentId, updatedParent)
  }

  // ============================================================================
  // Queries
  // ============================================================================

  /**
   * Get running agents
   */
  getRunningAgents(): Agent[] {
    return this.getAllAgents().filter(agentQueries.isRunning)
  }

  /**
   * Get completed agents
   */
  getCompletedAgents(): Agent[] {
    return this.getAllAgents().filter(agentQueries.isComplete)
  }

  /**
   * Get agents with errors
   */
  getErrorAgents(): Agent[] {
    return this.getAllAgents().filter(agentQueries.hasError)
  }

  /**
   * Get total telemetry across all agents
   */
  getTotalTelemetry(): Telemetry {
    const agents = this.getAllAgents()

    return agents.reduce(
      (total, agent) => ({
        tokensIn: total.tokensIn + agent.telemetry.tokensIn,
        tokensOut: total.tokensOut + agent.telemetry.tokensOut,
        cost: total.cost + agent.telemetry.cost,
        cached: (total.cached ?? 0) + (agent.telemetry.cached ?? 0),
      }),
      { tokensIn: 0, tokensOut: 0, cost: 0, cached: 0 }
    )
  }

  /**
   * Get total duration across all agents
   */
  getTotalDuration(now: number = Date.now()): number {
    const agents = this.getAllAgents()
    return agents.reduce((total, agent) => total + agentQueries.getDuration(agent, now), 0)
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear()
    this.agentsByStep.clear()
  }

  /**
   * Remove a specific agent
   */
  removeAgent(id: AgentId): void {
    const agent = this.agents.get(id)
    if (agent) {
      this.agents.delete(id)
      this.agentsByStep.delete(agent.stepIndex)
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentService: AgentService | null = null

export const getAgentService = (): AgentService => {
  if (!agentService) {
    agentService = new AgentService()
  }
  return agentService
}

export const resetAgentService = (): void => {
  agentService?.clear()
  agentService = null
}

// ============================================================================
// Factory Function
// ============================================================================

export const createAgentService = (config?: AgentServiceConfig): AgentService => {
  return new AgentService(config)
}
