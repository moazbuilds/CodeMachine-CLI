/**
 * Logs Schema
 *
 * Drizzle ORM schema for indexed logs with FTS5 full-text search.
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { agents } from './agents.js'

// Log level enum values
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

/**
 * Logs table
 *
 * Stores indexed log entries for fast searching and filtering.
 * Works with FTS5 virtual table for full-text search.
 */
export const logs = sqliteTable(
  'logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    agentId: integer('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
    level: text('level', { enum: LOG_LEVELS }).notNull(),
    message: text('message').notNull(),
    timestamp: integer('timestamp').notNull(),
    context: text('context', { mode: 'json' }),
    source: text('source'),
    correlationId: text('correlation_id'),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_logs_agent_id').on(table.agentId),
    index('idx_logs_level').on(table.level),
    index('idx_logs_timestamp').on(table.timestamp),
    index('idx_logs_correlation').on(table.correlationId),
  ]
)

/**
 * Logs relations
 */
export const logsRelations = relations(logs, ({ one }) => ({
  agent: one(agents, {
    fields: [logs.agentId],
    references: [agents.id],
  }),
}))

// Type inference
export type Log = typeof logs.$inferSelect
export type NewLog = typeof logs.$inferInsert

/**
 * Log search parameters
 */
export interface LogSearchParams {
  /** Full-text search query */
  query?: string
  /** Filter by log levels */
  level?: LogLevel | LogLevel[]
  /** Filter by agent ID */
  agentId?: number
  /** Filter by source */
  source?: string
  /** Filter by correlation ID */
  correlationId?: string
  /** Time range - start timestamp */
  from?: number
  /** Time range - end timestamp */
  to?: number
  /** Maximum results to return */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Sort order */
  order?: 'asc' | 'desc'
}

/**
 * Log search result with FTS highlighting
 */
export interface LogSearchResult extends Log {
  /** Highlighted message (if FTS search was used) */
  highlighted?: string
  /** Relevance rank (if FTS search was used) */
  rank?: number
}

/**
 * Log aggregation by level
 */
export interface LogLevelCounts {
  debug: number
  info: number
  warn: number
  error: number
  total: number
}
