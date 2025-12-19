/**
 * Persistent Telemetry Service
 *
 * Extends TelemetryService to persist telemetry snapshots to SQLite.
 * Enables historical analytics and crash recovery.
 */

import { getDatabase, type DrizzleDB } from '../../infrastructure/database/connection.js'
import { TelemetryRepository } from '../../infrastructure/database/repositories/telemetry.repository.js'
import type {
  NewTelemetrySnapshot,
  CostByPeriod,
  EngineUsage,
  WorkflowMetrics,
} from '../../infrastructure/database/schema/index.js'
import {
  TelemetryService,
  type TelemetryServiceConfig,
  type StepTelemetry,
  type WorkflowTelemetry,
} from './telemetry-service.js'
import type { EngineName, Telemetry } from '../../shared/types/index.js'

// ============================================================================
// Types
// ============================================================================

export interface PersistentTelemetryConfig extends TelemetryServiceConfig {
  /** Enable persistence (default: true) */
  enabled?: boolean
  /** Persist synchronously (default: false - async for performance) */
  sync?: boolean
  /** Database instance */
  db?: DrizzleDB
}

export interface HistoricalAnalytics {
  costByPeriod: CostByPeriod[]
  engineUsage: EngineUsage[]
  aggregateStats: {
    totalCost: number
    totalTokensIn: number
    totalTokensOut: number
    totalCachedTokens: number
    workflowCount: number
    stepCount: number
  }
}

// ============================================================================
// Persistent Telemetry Service
// ============================================================================

export class PersistentTelemetryService extends TelemetryService {
  private readonly repository: TelemetryRepository
  private readonly persistConfig: Required<Omit<PersistentTelemetryConfig, keyof TelemetryServiceConfig | 'db'>>
  private currentWorkflowId: string | null = null

  constructor(config?: PersistentTelemetryConfig) {
    super(config)

    const db = config?.db ?? getDatabase()
    this.repository = new TelemetryRepository(db)
    this.persistConfig = {
      enabled: config?.enabled ?? true,
      sync: config?.sync ?? false,
    }
  }

  // ============================================================================
  // Override Lifecycle Methods
  // ============================================================================

  /**
   * Initialize workflow telemetry with persistence
   */
  override initWorkflow(workflowId: string, totalSteps: number): void {
    super.initWorkflow(workflowId, totalSteps)
    this.currentWorkflowId = workflowId
  }

  /**
   * Complete workflow and persist final state
   */
  override completeWorkflow(): void {
    super.completeWorkflow()

    if (this.persistConfig.enabled && this.currentWorkflowId) {
      const workflow = this.getWorkflowTelemetry()
      if (workflow) {
        this.persistWorkflowCompletion(workflow)
      }
    }
  }

  /**
   * Complete step and persist snapshot
   */
  override completeStep(stepIndex: number): void {
    // Get step before completing (to capture telemetry)
    const step = this.getStepTelemetry(stepIndex)

    // Complete the step in parent
    super.completeStep(stepIndex)

    // Persist if enabled
    if (this.persistConfig.enabled && step && this.currentWorkflowId) {
      this.persistStepSnapshot(this.currentWorkflowId, step)
    }
  }

  /**
   * Reset and optionally persist daily aggregate
   */
  override reset(): void {
    // Persist daily aggregate before reset
    if (this.persistConfig.enabled) {
      this.persistDailyAggregate()
    }

    super.reset()
    this.currentWorkflowId = null
  }

  // ============================================================================
  // Persistence Methods
  // ============================================================================

  /**
   * Persist a step snapshot to SQLite
   */
  private persistStepSnapshot(workflowId: string, step: StepTelemetry): void {
    const snapshot: NewTelemetrySnapshot = {
      workflowId,
      stepIndex: step.stepIndex,
      agentId: typeof step.agentId === 'number' ? step.agentId : null,
      engine: step.engine,
      tokensIn: step.telemetry.tokensIn,
      tokensOut: step.telemetry.tokensOut,
      cachedTokens: step.telemetry.cached ?? 0,
      cost: step.telemetry.cost,
      duration: step.duration,
      timestamp: step.completedAt ?? Date.now(),
    }

    if (this.persistConfig.sync) {
      this.repository.insertSnapshot(snapshot).catch((err) => {
        console.error('[PersistentTelemetry] Failed to persist snapshot:', err)
      })
    } else {
      // Fire and forget for async mode
      void this.repository.insertSnapshot(snapshot).catch((err) => {
        console.error('[PersistentTelemetry] Failed to persist snapshot:', err)
      })
    }
  }

  /**
   * Persist workflow completion summary
   */
  private persistWorkflowCompletion(workflow: WorkflowTelemetry): void {
    // Workflow completion is already tracked via step snapshots
    // This could be used for additional summary logging or events
  }

  /**
   * Persist daily aggregate stats
   */
  private persistDailyAggregate(): void {
    const workflow = this.getWorkflowTelemetry()
    if (!workflow) return

    const today = new Date().toISOString().split('T')[0]

    const data = {
      date: today,
      totalTokensIn: workflow.aggregate.tokensIn,
      totalTokensOut: workflow.aggregate.tokensOut,
      totalCachedTokens: workflow.aggregate.cached ?? 0,
      totalCost: workflow.aggregate.cost,
      workflowCount: 1,
      stepCount: workflow.completedSteps,
    }

    void this.repository.upsertDailyAggregate(data).catch((err) => {
      console.error('[PersistentTelemetry] Failed to persist daily aggregate:', err)
    })
  }

  // ============================================================================
  // Analytics Queries
  // ============================================================================

  /**
   * Get historical analytics for a time range
   */
  async getHistoricalAnalytics(from: number, to: number): Promise<HistoricalAnalytics> {
    const [costByPeriod, engineUsage, aggregateStats] = await Promise.all([
      this.repository.getCostByPeriod(from, to),
      this.repository.getEngineUsage(from, to),
      this.repository.getAggregateStats(from, to),
    ])

    return {
      costByPeriod,
      engineUsage,
      aggregateStats,
    }
  }

  /**
   * Get cost breakdown by day
   */
  async getCostByPeriod(from: number, to: number): Promise<CostByPeriod[]> {
    return this.repository.getCostByPeriod(from, to)
  }

  /**
   * Get engine usage statistics
   */
  async getEngineUsage(from?: number, to?: number): Promise<EngineUsage[]> {
    return this.repository.getEngineUsage(from, to)
  }

  /**
   * Get metrics for a specific workflow
   */
  async getWorkflowMetrics(workflowId: string): Promise<WorkflowMetrics | null> {
    return this.repository.getWorkflowMetrics(workflowId)
  }

  /**
   * Get all-time aggregate statistics
   */
  async getAggregateStats(): Promise<{
    totalCost: number
    totalTokensIn: number
    totalTokensOut: number
    totalCachedTokens: number
    workflowCount: number
    stepCount: number
  }> {
    return this.repository.getAggregateStats()
  }

  /**
   * Get daily aggregates for dashboard
   */
  async getDailyAggregates(days: number = 30): Promise<{
    date: string
    totalTokensIn: number
    totalTokensOut: number
    totalCost: number
    workflowCount: number
    stepCount: number
  }[]> {
    const to = new Date().toISOString().split('T')[0]
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    const from = fromDate.toISOString().split('T')[0]

    const results = await this.repository.getDailyAggregates(from, to)

    return results.map((r) => ({
      date: r.date,
      totalTokensIn: r.totalTokensIn ?? 0,
      totalTokensOut: r.totalTokensOut ?? 0,
      totalCost: r.totalCost ?? 0,
      workflowCount: r.workflowCount ?? 0,
      stepCount: r.stepCount ?? 0,
    }))
  }

  /**
   * Cleanup old telemetry data
   */
  async cleanupOlderThan(days: number): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return this.repository.deleteOlderThan(cutoff)
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let persistentTelemetryService: PersistentTelemetryService | null = null

/**
 * Get the global persistent telemetry service
 */
export function getPersistentTelemetryService(
  config?: PersistentTelemetryConfig
): PersistentTelemetryService {
  if (!persistentTelemetryService) {
    persistentTelemetryService = new PersistentTelemetryService(config)
  }
  return persistentTelemetryService
}

/**
 * Reset the global persistent telemetry service
 */
export function resetPersistentTelemetryService(): void {
  persistentTelemetryService?.reset()
  persistentTelemetryService = null
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPersistentTelemetryService(
  config?: PersistentTelemetryConfig
): PersistentTelemetryService {
  return new PersistentTelemetryService(config)
}
