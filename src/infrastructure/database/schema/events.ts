/**
 * Events Schema
 *
 * Drizzle ORM schema for event sourcing.
 * Stores all domain events for audit trail, debugging, and replay.
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

/**
 * Events table
 *
 * Stores all domain events with full payload for replay capability.
 */
export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    timestamp: integer('timestamp').notNull(),
    correlationId: text('correlation_id'),
    causationId: text('causation_id'),
    aggregateId: text('aggregate_id'),
    aggregateType: text('aggregate_type'),
    payload: text('payload', { mode: 'json' }).notNull(),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_events_type').on(table.type),
    index('idx_events_correlation').on(table.correlationId),
    index('idx_events_aggregate').on(table.aggregateId, table.aggregateType),
    index('idx_events_timestamp').on(table.timestamp),
  ]
)

// Type inference
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert

/**
 * Event query options
 */
export interface EventQueryOptions {
  /** Filter by event type */
  type?: string | string[]
  /** Filter by correlation ID */
  correlationId?: string
  /** Filter by aggregate */
  aggregateId?: string
  aggregateType?: string
  /** Time range filter */
  from?: number
  to?: number
  /** Pagination */
  limit?: number
  offset?: number
  /** Order */
  order?: 'asc' | 'desc'
}

/**
 * Event replay handler
 */
export type EventReplayHandler<T = unknown> = (event: {
  id: number
  type: string
  timestamp: number
  correlationId: string | null
  payload: T
}) => void | Promise<void>

/**
 * Event store statistics
 */
export interface EventStoreStats {
  totalEvents: number
  eventsByType: Record<string, number>
  oldestEvent: number | null
  newestEvent: number | null
}
