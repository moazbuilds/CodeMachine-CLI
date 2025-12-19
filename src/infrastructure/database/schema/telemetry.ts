/**
 * Telemetry Snapshots Schema
 *
 * Drizzle ORM schema for historical telemetry data.
 * Used for analytics, cost tracking, and performance monitoring.
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { agents } from './agents.js'

/**
 * Telemetry snapshots table
 *
 * Stores point-in-time telemetry data for historical analysis.
 * Each snapshot represents metrics at a specific moment (usually step completion).
 */
export const telemetrySnapshots = sqliteTable(
  'telemetry_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workflowId: text('workflow_id').notNull(),
    stepIndex: integer('step_index'),
    agentId: integer('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    engine: text('engine'),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    cachedTokens: integer('cached_tokens').default(0),
    cost: real('cost'),
    duration: integer('duration'),
    timestamp: integer('timestamp').notNull(),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_telemetry_snapshots_workflow').on(table.workflowId),
    index('idx_telemetry_snapshots_timestamp').on(table.timestamp),
    index('idx_telemetry_snapshots_engine').on(table.engine),
    index('idx_telemetry_snapshots_step').on(table.workflowId, table.stepIndex),
  ]
)

/**
 * Telemetry snapshots relations
 */
export const telemetrySnapshotsRelations = relations(telemetrySnapshots, ({ one }) => ({
  agent: one(agents, {
    fields: [telemetrySnapshots.agentId],
    references: [agents.id],
  }),
}))

/**
 * Daily aggregated telemetry
 *
 * Pre-computed daily aggregates for fast dashboard queries.
 */
export const telemetryDaily = sqliteTable(
  'telemetry_daily',
  {
    date: text('date').primaryKey(), // YYYY-MM-DD
    totalTokensIn: integer('total_tokens_in').default(0),
    totalTokensOut: integer('total_tokens_out').default(0),
    totalCachedTokens: integer('total_cached_tokens').default(0),
    totalCost: real('total_cost').default(0),
    workflowCount: integer('workflow_count').default(0),
    stepCount: integer('step_count').default(0),
    avgDuration: integer('avg_duration'),
    updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
  }
)

// Type inference
export type TelemetrySnapshot = typeof telemetrySnapshots.$inferSelect
export type NewTelemetrySnapshot = typeof telemetrySnapshots.$inferInsert
export type TelemetryDaily = typeof telemetryDaily.$inferSelect
export type NewTelemetryDaily = typeof telemetryDaily.$inferInsert

/**
 * Analytics result types
 */
export interface CostByPeriod {
  date: string
  totalCost: number
  tokenCount: number
}

export interface EngineUsage {
  engine: string
  totalCost: number
  avgDuration: number
  usageCount: number
}

export interface WorkflowMetrics {
  workflowId: string
  totalCost: number
  totalTokens: number
  stepCount: number
  avgStepDuration: number
}
