/**
 * Zod Validation Schemas
 *
 * Runtime validation for external data, API boundaries, and configurations.
 * All schemas infer TypeScript types for type safety.
 */

import { z } from 'zod'

// ============================================================================
// Primitive Schemas
// ============================================================================

/** Non-empty string */
export const NonEmptyString = z.string().min(1)

/** Positive integer */
export const PositiveInt = z.number().int().positive()

/** Non-negative integer */
export const NonNegativeInt = z.number().int().nonnegative()

/** Non-negative number (for costs, etc.) */
export const NonNegativeNumber = z.number().nonnegative()

/** Unix timestamp (milliseconds) */
export const Timestamp = z.number().int().positive()

/** URL string */
export const UrlString = z.string().url()

/** File path (non-empty string) */
export const FilePath = z.string().min(1)

// ============================================================================
// ID Schemas (Branded Types)
// ============================================================================

export const WorkflowIdSchema = NonEmptyString.brand('WorkflowId')
export const StepIdSchema = NonEmptyString.brand('StepId')
export const AgentIdSchema = NonEmptyString.brand('AgentId')
export const SessionIdSchema = NonEmptyString.brand('SessionId')
export const MonitoringIdSchema = PositiveInt.brand('MonitoringId')

// ============================================================================
// Status Schemas
// ============================================================================

export const WorkflowStatusSchema = z.enum([
  'idle',
  'running',
  'waiting',
  'paused',
  'completed',
  'stopped',
  'error',
])

export const AgentStatusSchema = z.enum([
  'pending',
  'running',
  'waiting',
  'completed',
  'error',
  'skipped',
])

export const InputModeSchema = z.enum(['user', 'autopilot'])

// ============================================================================
// Telemetry Schemas
// ============================================================================

export const TelemetrySchema = z.object({
  tokensIn: NonNegativeInt,
  tokensOut: NonNegativeInt,
  cost: NonNegativeNumber,
  cached: NonNegativeInt.optional(),
})

export const DurationSchema = z.object({
  startedAt: Timestamp,
  endedAt: Timestamp.optional(),
  pausedDuration: NonNegativeInt,
  total: NonNegativeInt,
})

export const TelemetrySnapshotSchema = z.object({
  workflowId: NonEmptyString,
  stepIndex: NonNegativeInt.optional(),
  agentId: z.number().int().nullable().optional(),
  agentName: NonEmptyString.optional(),
  engine: NonEmptyString.optional(),
  tokensIn: NonNegativeInt,
  tokensOut: NonNegativeInt,
  cachedTokens: NonNegativeInt.optional(),
  cost: NonNegativeNumber,
  duration: NonNegativeInt.optional(),
  timestamp: Timestamp,
})

// ============================================================================
// Engine Schemas
// ============================================================================

export const EngineNameSchema = z.enum([
  'claude',
  'cursor',
  'codex',
  'ccr',
  'auggie',
  'opencode',
  'gemini',
])

export const EngineCapabilitiesSchema = z.object({
  streaming: z.boolean(),
  multiTurn: z.boolean(),
  toolUse: z.boolean(),
  maxTokens: PositiveInt,
})

// ============================================================================
// Step Configuration Schemas
// ============================================================================

export const StepAutopilotConfigSchema = z.object({
  skip: z.boolean().optional(),
  agent: NonEmptyString.optional(),
  hints: z.string().optional(),
  maxIterations: PositiveInt.optional(),
  defaultAction: z.enum(['next', 'continue', 'wait']).optional(),
})

export const ChainedPromptSchema = z.object({
  name: NonEmptyString,
  label: NonEmptyString,
  content: NonEmptyString,
  conditions: z.array(NonEmptyString).optional(),
})

// ============================================================================
// Module Behavior Schemas
// ============================================================================

export const LoopModuleBehaviorSchema = z.object({
  type: z.literal('loop'),
  action: z.literal('stepBack'),
  steps: PositiveInt,
  trigger: NonEmptyString.optional(),
  maxIterations: PositiveInt.optional(),
  skip: z.array(NonEmptyString).optional(),
})

export const TriggerModuleBehaviorSchema = z.object({
  type: z.literal('trigger'),
  action: z.literal('mainAgentCall'),
  triggerAgentId: NonEmptyString,
})

export const CheckpointModuleBehaviorSchema = z.object({
  type: z.literal('checkpoint'),
  action: z.literal('evaluate'),
})

export const ModuleBehaviorSchema = z.discriminatedUnion('type', [
  LoopModuleBehaviorSchema,
  TriggerModuleBehaviorSchema,
  CheckpointModuleBehaviorSchema,
])

export const ModuleMetadataSchema = z.object({
  id: NonEmptyString,
  behavior: ModuleBehaviorSchema.optional(),
})

// ============================================================================
// Workflow Step Schemas
// ============================================================================

export const ModuleStepSchema = z.object({
  type: z.literal('module'),
  agentId: NonEmptyString,
  agentName: NonEmptyString,
  promptPath: z.union([NonEmptyString, z.array(NonEmptyString)]),
  model: NonEmptyString.optional(),
  modelReasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  engine: NonEmptyString.optional(),
  module: ModuleMetadataSchema.optional(),
  executeOnce: z.boolean().optional(),
  notCompletedFallback: NonEmptyString.optional(),
  tracks: z.array(NonEmptyString).optional(),
  conditions: z.array(NonEmptyString).optional(),
  autopilot: StepAutopilotConfigSchema.optional(),
})

export const UIStepSchema = z.object({
  type: z.literal('ui'),
  text: NonEmptyString,
})

export const WorkflowStepSchema = z.discriminatedUnion('type', [
  ModuleStepSchema,
  UIStepSchema,
])

// ============================================================================
// Workflow Template Schemas
// ============================================================================

export const TrackConfigSchema = z.object({
  label: NonEmptyString,
  description: z.string().optional(),
})

export const ConditionConfigSchema = z.object({
  label: NonEmptyString,
  description: z.string().optional(),
})

export const TemplateAutopilotConfigSchema = z.object({
  enabled: z.boolean().optional(),
  skipSteps: z.array(NonEmptyString).optional(),
  defaultAction: z.enum(['next', 'continue', 'wait']).optional(),
  maxStepIterations: PositiveInt.optional(),
})

export const WorkflowTemplateSchema = z.object({
  name: NonEmptyString,
  steps: z.array(WorkflowStepSchema).min(1),
  subAgentIds: z.array(NonEmptyString).optional(),
  tracks: z.record(NonEmptyString, TrackConfigSchema).optional(),
  conditions: z.record(NonEmptyString, ConditionConfigSchema).optional(),
  autopilot: TemplateAutopilotConfigSchema.optional(),
  controller: z.boolean().optional(), // Legacy field
})

// ============================================================================
// Event Schemas
// ============================================================================

export const DomainEventSchema = z.object({
  type: NonEmptyString,
  timestamp: Timestamp,
  correlationId: NonEmptyString.optional(),
  aggregateId: NonEmptyString.optional(),
  version: PositiveInt.optional(),
  payload: z.record(z.string(), z.unknown()),
})

// ============================================================================
// Log Schemas
// ============================================================================

export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error'])

export const LogEntrySchema = z.object({
  level: LogLevelSchema,
  message: NonEmptyString,
  timestamp: Timestamp,
  agentId: z.number().int().nullable().optional(),
  source: NonEmptyString.nullable().optional(),
  correlationId: NonEmptyString.nullable().optional(),
  context: z.record(z.string(), z.unknown()).nullable().optional(),
})

// ============================================================================
// Configuration Schemas
// ============================================================================

export const DatabaseConfigSchema = z.object({
  path: FilePath.optional(),
  inMemory: z.boolean().optional(),
  walMode: z.boolean().optional(),
  busyTimeout: PositiveInt.optional(),
  cacheSize: z.number().int().optional(),
})

export const PersistenceConfigSchema = z.object({
  enabled: z.boolean().optional(),
  async: z.boolean().optional(),
  batchSize: PositiveInt.optional(),
  batchIntervalMs: PositiveInt.optional(),
})

export const WorkflowOptionsSchema = z.object({
  cwd: FilePath.optional(),
  templatePath: FilePath.optional(),
  specificationPath: FilePath.optional(),
})

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type TelemetryInput = z.input<typeof TelemetrySchema>
export type TelemetryOutput = z.output<typeof TelemetrySchema>

export type DurationInput = z.input<typeof DurationSchema>
export type DurationOutput = z.output<typeof DurationSchema>

export type TelemetrySnapshotInput = z.input<typeof TelemetrySnapshotSchema>
export type TelemetrySnapshotOutput = z.output<typeof TelemetrySnapshotSchema>

export type EngineCapabilitiesInput = z.input<typeof EngineCapabilitiesSchema>
export type EngineCapabilitiesOutput = z.output<typeof EngineCapabilitiesSchema>

export type ModuleStepInput = z.input<typeof ModuleStepSchema>
export type ModuleStepOutput = z.output<typeof ModuleStepSchema>

export type UIStepInput = z.input<typeof UIStepSchema>
export type UIStepOutput = z.output<typeof UIStepSchema>

export type WorkflowStepInput = z.input<typeof WorkflowStepSchema>
export type WorkflowStepOutput = z.output<typeof WorkflowStepSchema>

export type WorkflowTemplateInput = z.input<typeof WorkflowTemplateSchema>
export type WorkflowTemplateOutput = z.output<typeof WorkflowTemplateSchema>

export type DomainEventInput = z.input<typeof DomainEventSchema>
export type DomainEventOutput = z.output<typeof DomainEventSchema>

export type LogEntryInput = z.input<typeof LogEntrySchema>
export type LogEntryOutput = z.output<typeof LogEntrySchema>

export type DatabaseConfigInput = z.input<typeof DatabaseConfigSchema>
export type DatabaseConfigOutput = z.output<typeof DatabaseConfigSchema>
