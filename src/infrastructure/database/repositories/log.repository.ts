/**
 * Log Repository
 *
 * Type-safe repository for indexed logs with FTS5 full-text search.
 */

import { eq, and, desc, asc, sql, gte, lte, inArray } from 'drizzle-orm'
import type { DrizzleDB } from '../connection.js'
import { getRawDatabase } from '../connection.js'
import {
  logs,
  type Log,
  type NewLog,
  type LogLevel,
  type LogSearchParams,
  type LogSearchResult,
  type LogLevelCounts,
} from '../schema/index.js'

export class LogRepository {
  constructor(private db: DrizzleDB) {}

  /**
   * Insert a single log entry
   */
  async insert(log: NewLog): Promise<number> {
    const [result] = await this.db.insert(logs).values(log).returning({ id: logs.id })
    return result.id
  }

  /**
   * Insert multiple log entries in a batch
   */
  async insertBatch(logEntries: NewLog[]): Promise<number[]> {
    if (logEntries.length === 0) return []

    const results = await this.db.insert(logs).values(logEntries).returning({ id: logs.id })
    return results.map((r) => r.id)
  }

  /**
   * Get a log by ID
   */
  async get(id: number): Promise<Log | null> {
    const result = await this.db.query.logs.findFirst({
      where: eq(logs.id, id),
    })
    return result ?? null
  }

  /**
   * Search logs with optional FTS5 full-text search
   */
  async search(params: LogSearchParams = {}): Promise<LogSearchResult[]> {
    // Use FTS5 for text search
    if (params.query) {
      return this.fullTextSearch(params)
    }

    // Regular filtered search
    return this.filteredSearch(params)
  }

  /**
   * Full-text search using FTS5
   */
  private async fullTextSearch(params: LogSearchParams): Promise<LogSearchResult[]> {
    const rawDb = getRawDatabase()
    const conditions: string[] = []
    const values: (string | number)[] = []

    // FTS5 match
    let paramIndex = 1
    const ftsQuery = params.query!

    // Build additional filter conditions
    if (params.agentId !== undefined) {
      conditions.push(`logs.agent_id = ?${paramIndex++}`)
      values.push(params.agentId)
    }

    if (params.level) {
      const levels = Array.isArray(params.level) ? params.level : [params.level]
      conditions.push(`logs.level IN (${levels.map(() => `?${paramIndex++}`).join(', ')})`)
      values.push(...levels)
    }

    if (params.from !== undefined) {
      conditions.push(`logs.timestamp >= ?${paramIndex++}`)
      values.push(params.from)
    }

    if (params.to !== undefined) {
      conditions.push(`logs.timestamp <= ?${paramIndex++}`)
      values.push(params.to)
    }

    if (params.correlationId) {
      conditions.push(`logs.correlation_id = ?${paramIndex++}`)
      values.push(params.correlationId)
    }

    if (params.source) {
      conditions.push(`logs.source = ?${paramIndex++}`)
      values.push(params.source)
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''
    const limit = params.limit ?? 100
    const offset = params.offset ?? 0
    const orderDir = params.order === 'asc' ? 'ASC' : 'DESC'

    // FTS5 query with highlighting and ranking
    const query = `
      SELECT
        logs.*,
        highlight(logs_fts, 0, '<mark>', '</mark>') as highlighted,
        rank as fts_rank
      FROM logs_fts
      INNER JOIN logs ON logs_fts.rowid = logs.id
      WHERE logs_fts MATCH ?
      ${whereClause}
      ORDER BY rank ${orderDir}
      LIMIT ? OFFSET ?
    `

    try {
      const results = rawDb.prepare(query).all(ftsQuery, ...values, limit, offset) as Array<
        Log & { highlighted: string; fts_rank: number }
      >

      return results.map((row) => ({
        ...row,
        highlighted: row.highlighted,
        rank: row.fts_rank,
        context: row.context ? JSON.parse(row.context as string) : null,
      }))
    } catch (error) {
      // FTS5 query syntax error - fall back to filtered search
      console.warn('[LogRepository] FTS5 query failed, falling back to filtered search:', error)
      return this.filteredSearch({ ...params, query: undefined })
    }
  }

  /**
   * Filtered search without full-text
   */
  private async filteredSearch(params: LogSearchParams): Promise<LogSearchResult[]> {
    const conditions = []

    if (params.agentId !== undefined) {
      conditions.push(eq(logs.agentId, params.agentId))
    }

    if (params.level) {
      const levels = Array.isArray(params.level) ? params.level : [params.level]
      conditions.push(inArray(logs.level, levels))
    }

    if (params.from !== undefined) {
      conditions.push(gte(logs.timestamp, params.from))
    }

    if (params.to !== undefined) {
      conditions.push(lte(logs.timestamp, params.to))
    }

    if (params.correlationId) {
      conditions.push(eq(logs.correlationId, params.correlationId))
    }

    if (params.source) {
      conditions.push(eq(logs.source, params.source))
    }

    const orderBy = params.order === 'asc' ? asc(logs.timestamp) : desc(logs.timestamp)

    const query = this.db
      .select()
      .from(logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)

    if (params.limit) {
      query.limit(params.limit)
    }
    if (params.offset) {
      query.offset(params.offset)
    }

    const results = await query

    return results.map((row) => ({
      ...row,
      context: row.context as Record<string, unknown> | null,
    }))
  }

  /**
   * Get logs by agent ID
   */
  async getByAgent(agentId: number, limit?: number): Promise<Log[]> {
    return this.search({ agentId, limit, order: 'desc' })
  }

  /**
   * Get recent logs
   */
  async getRecent(limit: number = 100): Promise<Log[]> {
    return this.search({ limit, order: 'desc' })
  }

  /**
   * Get error logs
   */
  async getErrors(options?: { agentId?: number; from?: number; limit?: number }): Promise<Log[]> {
    return this.search({
      level: 'error',
      ...options,
      order: 'desc',
    })
  }

  /**
   * Count logs by level
   */
  async countByLevel(agentId?: number): Promise<LogLevelCounts> {
    const conditions = agentId !== undefined ? [eq(logs.agentId, agentId)] : []

    const results = await this.db
      .select({
        level: logs.level,
        count: sql<number>`COUNT(*)`,
      })
      .from(logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(logs.level)

    const counts: LogLevelCounts = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      total: 0,
    }

    for (const row of results) {
      counts[row.level as LogLevel] = row.count
      counts.total += row.count
    }

    return counts
  }

  /**
   * Delete logs older than a timestamp
   */
  async deleteOlderThan(timestamp: number): Promise<number> {
    const result = await this.db
      .delete(logs)
      .where(lte(logs.timestamp, timestamp))
      .returning({ id: logs.id })

    return result.length
  }

  /**
   * Delete logs by agent ID
   */
  async deleteByAgent(agentId: number): Promise<number> {
    const result = await this.db
      .delete(logs)
      .where(eq(logs.agentId, agentId))
      .returning({ id: logs.id })

    return result.length
  }

  /**
   * Clear all logs
   */
  async clearAll(): Promise<number> {
    const result = await this.db.delete(logs).returning({ id: logs.id })
    return result.length
  }
}
