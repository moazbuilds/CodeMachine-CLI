/**
 * Agent Repository
 *
 * Type-safe repository for agent CRUD operations using Drizzle ORM.
 */

import { eq, and, desc, sql, isNull } from 'drizzle-orm'
import type { DrizzleDB } from '../connection.js'
import {
  agents,
  telemetry,
  type Agent,
  type NewAgent,
  type Telemetry,
  type NewTelemetry,
  type AgentStatus,
} from '../schema/index.js'

/**
 * Agent with telemetry data
 */
export interface AgentWithTelemetry extends Agent {
  telemetry: Telemetry | null
  children?: Agent[]
}

/**
 * Input for registering a new agent
 */
export interface RegisterAgentInput {
  name: string
  prompt: string
  parentId?: number
  engine?: string
  pid?: number
  engineProvider?: string
  modelName?: string
  logPath: string
}

/**
 * Agent update input
 */
export interface UpdateAgentInput {
  status?: AgentStatus
  endTime?: number
  duration?: number
  error?: string
  logPath?: string
  sessionId?: string
  accumulatedDuration?: number
  lastDurationUpdate?: number
  pauseCount?: number
}

/**
 * Telemetry update input
 */
export interface UpdateTelemetryInput {
  tokensIn?: number
  tokensOut?: number
  cachedTokens?: number
  cost?: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
}

export class AgentRepository {
  constructor(private db: DrizzleDB) {}

  /**
   * Register a new agent
   */
  async register(input: RegisterAgentInput): Promise<number> {
    const trimmedPrompt =
      input.prompt.length > 500 ? `${input.prompt.substring(0, 500)}...` : input.prompt

    const [result] = await this.db
      .insert(agents)
      .values({
        name: input.name,
        prompt: trimmedPrompt,
        parentId: input.parentId ?? null,
        engine: input.engine ?? null,
        status: 'running',
        startTime: Date.now(),
        logPath: input.logPath,
        pid: input.pid ?? null,
        engineProvider: input.engineProvider ?? null,
        modelName: input.modelName ?? null,
      })
      .returning({ id: agents.id })

    return result.id
  }

  /**
   * Get an agent by ID with telemetry
   */
  async get(id: number): Promise<AgentWithTelemetry | null> {
    const result = await this.db.query.agents.findFirst({
      where: eq(agents.id, id),
      with: {
        telemetry: true,
      },
    })

    return result ? { ...result, telemetry: result.telemetry ?? null } : null
  }

  /**
   * Get all agents with telemetry
   */
  async getAll(): Promise<AgentWithTelemetry[]> {
    const results = await this.db.query.agents.findMany({
      with: {
        telemetry: true,
      },
      orderBy: [agents.id],
    })

    return results.map((r) => ({ ...r, telemetry: r.telemetry ?? null }))
  }

  /**
   * Get children of an agent
   */
  async getChildren(parentId: number): Promise<AgentWithTelemetry[]> {
    const results = await this.db.query.agents.findMany({
      where: eq(agents.parentId, parentId),
      with: {
        telemetry: true,
      },
      orderBy: [agents.id],
    })

    return results.map((r) => ({ ...r, telemetry: r.telemetry ?? null }))
  }

  /**
   * Get root agents (no parent)
   */
  async getRootAgents(): Promise<AgentWithTelemetry[]> {
    const results = await this.db.query.agents.findMany({
      where: isNull(agents.parentId),
      with: {
        telemetry: true,
      },
      orderBy: [desc(agents.id)],
    })

    return results.map((r) => ({ ...r, telemetry: r.telemetry ?? null }))
  }

  /**
   * Update an agent
   */
  async update(id: number, updates: UpdateAgentInput): Promise<void> {
    const updateData: Partial<Agent> = {
      updatedAt: Date.now(),
    }

    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.endTime !== undefined) updateData.endTime = updates.endTime
    if (updates.duration !== undefined) updateData.duration = updates.duration
    if (updates.error !== undefined) updateData.error = updates.error
    if (updates.logPath !== undefined) updateData.logPath = updates.logPath
    if (updates.sessionId !== undefined) updateData.sessionId = updates.sessionId
    if (updates.accumulatedDuration !== undefined)
      updateData.accumulatedDuration = updates.accumulatedDuration
    if (updates.lastDurationUpdate !== undefined)
      updateData.lastDurationUpdate = updates.lastDurationUpdate
    if (updates.pauseCount !== undefined) updateData.pauseCount = updates.pauseCount

    await this.db.update(agents).set(updateData).where(eq(agents.id, id))
  }

  /**
   * Update agent telemetry
   */
  async updateTelemetry(agentId: number, input: UpdateTelemetryInput): Promise<void> {
    await this.db
      .insert(telemetry)
      .values({
        agentId,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        cachedTokens: input.cachedTokens ?? 0,
        cost: input.cost ?? null,
        cacheCreationTokens: input.cacheCreationTokens ?? null,
        cacheReadTokens: input.cacheReadTokens ?? null,
      })
      .onConflictDoUpdate({
        target: telemetry.agentId,
        set: {
          tokensIn: input.tokensIn ?? sql`${telemetry.tokensIn}`,
          tokensOut: input.tokensOut ?? sql`${telemetry.tokensOut}`,
          cachedTokens: input.cachedTokens ?? sql`${telemetry.cachedTokens}`,
          cost: input.cost ?? sql`${telemetry.cost}`,
          cacheCreationTokens: input.cacheCreationTokens ?? sql`${telemetry.cacheCreationTokens}`,
          cacheReadTokens: input.cacheReadTokens ?? sql`${telemetry.cacheReadTokens}`,
        },
      })
  }

  /**
   * Persist duration atomically (hot path - called every second)
   */
  async persistDuration(id: number, duration: number): Promise<void> {
    await this.db
      .update(agents)
      .set({
        accumulatedDuration: duration,
        lastDurationUpdate: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(agents.id, id))
  }

  /**
   * Delete an agent
   */
  async delete(id: number): Promise<void> {
    await this.db.delete(agents).where(eq(agents.id, id))
  }

  /**
   * Clear all agents
   */
  async clearAll(): Promise<number> {
    // Telemetry is deleted via CASCADE
    const result = await this.db.delete(agents).returning({ id: agents.id })
    return result.length
  }

  /**
   * Get full subtree of an agent (agent + all descendants)
   */
  async getFullSubtree(agentId: number): Promise<AgentWithTelemetry[]> {
    const agent = await this.get(agentId)
    if (!agent) return []

    const result = [agent]
    const children = await this.getChildren(agentId)

    for (const child of children) {
      const subtree = await this.getFullSubtree(child.id)
      result.push(...subtree)
    }

    return result
  }

  /**
   * Clear all descendants of an agent
   */
  async clearDescendants(agentId: number): Promise<number> {
    const children = await this.getChildren(agentId)
    let count = 0

    for (const child of children) {
      count += await this.clearDescendants(child.id)
      await this.delete(child.id)
      count++
    }

    return count
  }

  /**
   * Get the maximum agent ID
   */
  async getMaxId(): Promise<number> {
    const result = await this.db
      .select({ maxId: sql<number>`MAX(${agents.id})` })
      .from(agents)

    return result[0]?.maxId ?? 0
  }

  /**
   * Get agents by status
   */
  async getByStatus(status: AgentStatus): Promise<AgentWithTelemetry[]> {
    const results = await this.db.query.agents.findMany({
      where: eq(agents.status, status),
      with: {
        telemetry: true,
      },
      orderBy: [desc(agents.startTime)],
    })

    return results.map((r) => ({ ...r, telemetry: r.telemetry ?? null }))
  }

  /**
   * Get agents by session ID
   */
  async getBySessionId(sessionId: string): Promise<AgentWithTelemetry[]> {
    const results = await this.db.query.agents.findMany({
      where: eq(agents.sessionId, sessionId),
      with: {
        telemetry: true,
      },
      orderBy: [agents.id],
    })

    return results.map((r) => ({ ...r, telemetry: r.telemetry ?? null }))
  }

  /**
   * Complete an agent (set status, end time, duration)
   */
  async complete(
    id: number,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    const agent = await this.get(id)
    if (!agent) return

    const endTime = Date.now()
    const duration = endTime - agent.startTime

    await this.update(id, {
      status,
      endTime,
      duration,
      error,
    })
  }
}
