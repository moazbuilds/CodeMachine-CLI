/**
 * Workflow State Schema
 *
 * Drizzle ORM schema for persistent workflow state and crash recovery.
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// Workflow state enum values
export const WORKFLOW_STATES = ['idle', 'running', 'waiting', 'completed', 'stopped', 'error'] as const
export type WorkflowStateValue = (typeof WORKFLOW_STATES)[number]

/**
 * Workflow states table
 *
 * Persists workflow state machine context for crash recovery.
 */
export const workflowStates = sqliteTable('workflow_states', {
  id: text('id').primaryKey(),
  state: text('state', { enum: WORKFLOW_STATES }).notNull(),
  currentStepIndex: integer('current_step_index').notNull().default(0),
  totalSteps: integer('total_steps').notNull().default(0),
  autoMode: integer('auto_mode', { mode: 'boolean' }).notNull().default(false),
  context: text('context', { mode: 'json' }),
  cmRoot: text('cm_root').notNull(),
  cwd: text('cwd').notNull(),
  startedAt: integer('started_at'),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * Workflow checkpoints table
 *
 * Stores recovery points for each completed step.
 */
export const workflowCheckpoints = sqliteTable(
  'workflow_checkpoints',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflowStates.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    output: text('output'),
    sessionId: text('session_id'),
    monitoringId: integer('monitoring_id'),
    timestamp: integer('timestamp').notNull(),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_checkpoints_workflow').on(table.workflowId),
    index('idx_checkpoints_step').on(table.workflowId, table.stepIndex),
  ]
)

/**
 * Workflow states relations
 */
export const workflowStatesRelations = relations(workflowStates, ({ many }) => ({
  checkpoints: many(workflowCheckpoints),
}))

/**
 * Workflow checkpoints relations
 */
export const workflowCheckpointsRelations = relations(workflowCheckpoints, ({ one }) => ({
  workflow: one(workflowStates, {
    fields: [workflowCheckpoints.workflowId],
    references: [workflowStates.id],
  }),
}))

// Type inference
export type WorkflowState = typeof workflowStates.$inferSelect
export type NewWorkflowState = typeof workflowStates.$inferInsert
export type WorkflowCheckpoint = typeof workflowCheckpoints.$inferSelect
export type NewWorkflowCheckpoint = typeof workflowCheckpoints.$inferInsert

/**
 * Workflow context stored in the context JSON field
 */
export interface PersistedWorkflowContext {
  templateId?: string
  projectName?: string
  currentStepConfig?: unknown
  promptQueue?: unknown[]
  variables?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
  }
}

/**
 * Recovery result from crash recovery
 */
export interface WorkflowRecoveryResult {
  workflowState: WorkflowState
  checkpoints: WorkflowCheckpoint[]
  lastCompletedStep: number
  canResume: boolean
}
