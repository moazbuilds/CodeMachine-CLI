/**
 * Telemetry Repository
 *
 * Type-safe repository for telemetry snapshots and analytics.
 */

import { eq, and, desc, sql, gte, lte, sum, avg, count } from 'drizzle-orm'
import type { DrizzleDB } from '../connection.js'
import {
  telemetrySnapshots,
  telemetryDaily,
  type TelemetrySnapshot,
  type NewTelemetrySnapshot,
  type TelemetryDaily,
  type NewTelemetryDaily,
  type CostByPeriod,
  type EngineUsage,
  type WorkflowMetrics,
} from '../schema/index.js'

export class TelemetryRepository {
  constructor(private db: DrizzleDB) {}

  /**
   * Insert a telemetry snapshot
   */
  async insertSnapshot(snapshot: NewTelemetrySnapshot): Promise<number> {
    const [result] = await this.db
      .insert(telemetrySnapshots)
      .values(snapshot)
      .returning({ id: telemetrySnapshots.id })
    return result.id
  }

  /**
   * Insert multiple snapshots in a batch
   */
  async insertSnapshots(snapshots: NewTelemetrySnapshot[]): Promise<number[]> {
    if (snapshots.length === 0) return []

    const results = await this.db
      .insert(telemetrySnapshots)
      .values(snapshots)
      .returning({ id: telemetrySnapshots.id })
    return results.map((r) => r.id)
  }

  /**
   * Get snapshots by workflow ID
   */
  async getByWorkflow(workflowId: string): Promise<TelemetrySnapshot[]> {
    return this.db.query.telemetrySnapshots.findMany({
      where: eq(telemetrySnapshots.workflowId, workflowId),
      orderBy: [telemetrySnapshots.stepIndex, telemetrySnapshots.timestamp],
    })
  }

  /**
   * Get snapshots by time range
   */
  async getByTimeRange(from: number, to: number): Promise<TelemetrySnapshot[]> {
    return this.db.query.telemetrySnapshots.findMany({
      where: and(
        gte(telemetrySnapshots.timestamp, from),
        lte(telemetrySnapshots.timestamp, to)
      ),
      orderBy: [desc(telemetrySnapshots.timestamp)],
    })
  }

  /**
   * Get cost breakdown by period (day)
   */
  async getCostByPeriod(from: number, to: number): Promise<CostByPeriod[]> {
    const results = await this.db
      .select({
        date: sql<string>`date(${telemetrySnapshots.timestamp} / 1000, 'unixepoch')`,
        totalCost: sum(telemetrySnapshots.cost),
        tokenCount: sql<number>`SUM(${telemetrySnapshots.tokensIn} + ${telemetrySnapshots.tokensOut})`,
      })
      .from(telemetrySnapshots)
      .where(
        and(
          gte(telemetrySnapshots.timestamp, from),
          lte(telemetrySnapshots.timestamp, to)
        )
      )
      .groupBy(sql`date(${telemetrySnapshots.timestamp} / 1000, 'unixepoch')`)
      .orderBy(sql`date(${telemetrySnapshots.timestamp} / 1000, 'unixepoch')`)

    return results.map((r) => ({
      date: r.date,
      totalCost: Number(r.totalCost) || 0,
      tokenCount: Number(r.tokenCount) || 0,
    }))
  }

  /**
   * Get engine usage statistics
   */
  async getEngineUsage(from?: number, to?: number): Promise<EngineUsage[]> {
    const conditions = []
    if (from !== undefined) conditions.push(gte(telemetrySnapshots.timestamp, from))
    if (to !== undefined) conditions.push(lte(telemetrySnapshots.timestamp, to))

    const results = await this.db
      .select({
        engine: telemetrySnapshots.engine,
        totalCost: sum(telemetrySnapshots.cost),
        avgDuration: avg(telemetrySnapshots.duration),
        usageCount: count(),
      })
      .from(telemetrySnapshots)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(telemetrySnapshots.engine)

    return results
      .filter((r) => r.engine !== null)
      .map((r) => ({
        engine: r.engine!,
        totalCost: Number(r.totalCost) || 0,
        avgDuration: Number(r.avgDuration) || 0,
        usageCount: Number(r.usageCount) || 0,
      }))
  }

  /**
   * Get workflow metrics
   */
  async getWorkflowMetrics(workflowId: string): Promise<WorkflowMetrics | null> {
    const [result] = await this.db
      .select({
        workflowId: telemetrySnapshots.workflowId,
        totalCost: sum(telemetrySnapshots.cost),
        totalTokens: sql<number>`SUM(${telemetrySnapshots.tokensIn} + ${telemetrySnapshots.tokensOut})`,
        stepCount: count(),
        avgStepDuration: avg(telemetrySnapshots.duration),
      })
      .from(telemetrySnapshots)
      .where(eq(telemetrySnapshots.workflowId, workflowId))
      .groupBy(telemetrySnapshots.workflowId)

    if (!result) return null

    return {
      workflowId: result.workflowId,
      totalCost: Number(result.totalCost) || 0,
      totalTokens: Number(result.totalTokens) || 0,
      stepCount: Number(result.stepCount) || 0,
      avgStepDuration: Number(result.avgStepDuration) || 0,
    }
  }

  /**
   * Get aggregate statistics
   */
  async getAggregateStats(from?: number, to?: number): Promise<{
    totalCost: number
    totalTokensIn: number
    totalTokensOut: number
    totalCachedTokens: number
    workflowCount: number
    stepCount: number
  }> {
    const conditions = []
    if (from !== undefined) conditions.push(gte(telemetrySnapshots.timestamp, from))
    if (to !== undefined) conditions.push(lte(telemetrySnapshots.timestamp, to))

    const [result] = await this.db
      .select({
        totalCost: sum(telemetrySnapshots.cost),
        totalTokensIn: sum(telemetrySnapshots.tokensIn),
        totalTokensOut: sum(telemetrySnapshots.tokensOut),
        totalCachedTokens: sum(telemetrySnapshots.cachedTokens),
        workflowCount: sql<number>`COUNT(DISTINCT ${telemetrySnapshots.workflowId})`,
        stepCount: count(),
      })
      .from(telemetrySnapshots)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return {
      totalCost: Number(result?.totalCost) || 0,
      totalTokensIn: Number(result?.totalTokensIn) || 0,
      totalTokensOut: Number(result?.totalTokensOut) || 0,
      totalCachedTokens: Number(result?.totalCachedTokens) || 0,
      workflowCount: Number(result?.workflowCount) || 0,
      stepCount: Number(result?.stepCount) || 0,
    }
  }

  /**
   * Update or insert daily aggregates
   */
  async upsertDailyAggregate(data: NewTelemetryDaily): Promise<void> {
    await this.db
      .insert(telemetryDaily)
      .values(data)
      .onConflictDoUpdate({
        target: telemetryDaily.date,
        set: {
          totalTokensIn: sql`${telemetryDaily.totalTokensIn} + ${data.totalTokensIn ?? 0}`,
          totalTokensOut: sql`${telemetryDaily.totalTokensOut} + ${data.totalTokensOut ?? 0}`,
          totalCachedTokens: sql`${telemetryDaily.totalCachedTokens} + ${data.totalCachedTokens ?? 0}`,
          totalCost: sql`${telemetryDaily.totalCost} + ${data.totalCost ?? 0}`,
          workflowCount: sql`${telemetryDaily.workflowCount} + ${data.workflowCount ?? 0}`,
          stepCount: sql`${telemetryDaily.stepCount} + ${data.stepCount ?? 0}`,
          updatedAt: Date.now(),
        },
      })
  }

  /**
   * Get daily aggregates by date range
   */
  async getDailyAggregates(from: string, to: string): Promise<TelemetryDaily[]> {
    return this.db.query.telemetryDaily.findMany({
      where: and(
        gte(telemetryDaily.date, from),
        lte(telemetryDaily.date, to)
      ),
      orderBy: [telemetryDaily.date],
    })
  }

  /**
   * Delete old snapshots
   */
  async deleteOlderThan(timestamp: number): Promise<number> {
    const result = await this.db
      .delete(telemetrySnapshots)
      .where(lte(telemetrySnapshots.timestamp, timestamp))
      .returning({ id: telemetrySnapshots.id })

    return result.length
  }
}
