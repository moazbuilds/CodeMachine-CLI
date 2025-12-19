/**
 * Agents Schema
 *
 * Drizzle ORM schema for the agents table.
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// Agent status enum values
export const AGENT_STATUS = ['running', 'completed', 'failed', 'paused'] as const
export type AgentStatus = (typeof AGENT_STATUS)[number]

/**
 * Agents table
 *
 * Stores information about running and completed agents.
 */
export const agents = sqliteTable(
  'agents',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    engine: text('engine'),
    status: text('status', { enum: AGENT_STATUS }).notNull(),
    // Self-reference handled by raw SQL in connection.ts
    // Foreign key: REFERENCES agents(id) ON DELETE CASCADE
    parentId: integer('parent_id'),
    pid: integer('pid'),
    startTime: integer('start_time').notNull(),
    endTime: integer('end_time'),
    duration: integer('duration'),
    prompt: text('prompt').notNull(),
    logPath: text('log_path').notNull(),
    error: text('error'),
    engineProvider: text('engine_provider'),
    modelName: text('model_name'),
    sessionId: text('session_id'),
    accumulatedDuration: integer('accumulated_duration').default(0),
    lastDurationUpdate: integer('last_duration_update'),
    pauseCount: integer('pause_count').default(0),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_agents_parent_id').on(table.parentId),
    index('idx_agents_status').on(table.status),
    index('idx_agents_session_id').on(table.sessionId),
  ]
)

/**
 * Agent relations
 */
export const agentsRelations = relations(agents, ({ one, many }) => ({
  parent: one(agents, {
    fields: [agents.parentId],
    references: [agents.id],
    relationName: 'parent_child',
  }),
  children: many(agents, { relationName: 'parent_child' }),
  telemetry: one(telemetry, {
    fields: [agents.id],
    references: [telemetry.agentId],
  }),
}))

/**
 * Telemetry table
 *
 * Stores token usage and cost information per agent.
 */
export const telemetry = sqliteTable(
  'telemetry',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    agentId: integer('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .unique(),
    tokensIn: integer('tokens_in').default(0),
    tokensOut: integer('tokens_out').default(0),
    cachedTokens: integer('cached_tokens').default(0),
    cost: real('cost'),
    cacheCreationTokens: integer('cache_creation_tokens'),
    cacheReadTokens: integer('cache_read_tokens'),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [index('idx_telemetry_agent_id').on(table.agentId)]
)

/**
 * Telemetry relations
 */
export const telemetryRelations = relations(telemetry, ({ one }) => ({
  agent: one(agents, {
    fields: [telemetry.agentId],
    references: [agents.id],
  }),
}))

// Type inference
export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type Telemetry = typeof telemetry.$inferSelect
export type NewTelemetry = typeof telemetry.$inferInsert
