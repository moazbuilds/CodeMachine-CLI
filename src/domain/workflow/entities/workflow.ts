/**
 * Workflow Aggregate Root
 *
 * The central entity representing a workflow execution.
 * Immutable - all modifications return new instances.
 */

import type {
  WorkflowId,
  StepConfig,
  WorkflowStatus,
  Telemetry,
  InputMode,
  createWorkflowId,
} from '../../../shared/types'
import type { Step, StepState } from './step'

// ============================================================================
// Workflow Entity
// ============================================================================

export interface Workflow {
  readonly id: WorkflowId
  readonly name: string
  readonly status: WorkflowStatus
  readonly steps: Step[]
  readonly currentStepIndex: number
  readonly mode: InputMode
  readonly startedAt: number | null
  readonly completedAt: number | null
  readonly pausedAt: number | null
  readonly telemetry: Telemetry
  readonly config: WorkflowConfig
}

export interface WorkflowConfig {
  readonly cwd: string
  readonly cmRoot: string
  readonly templateName: string
  readonly tracks: string[]
  readonly conditions: string[]
  readonly autopilotEnabled: boolean
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createWorkflow = (
  id: WorkflowId,
  name: string,
  steps: Step[],
  config: WorkflowConfig
): Workflow => ({
  id,
  name,
  status: 'idle',
  steps,
  currentStepIndex: 0,
  mode: config.autopilotEnabled ? 'autopilot' : 'user',
  startedAt: null,
  completedAt: null,
  pausedAt: null,
  telemetry: { tokensIn: 0, tokensOut: 0, cost: 0 },
  config,
})

// ============================================================================
// Workflow Operations (Immutable)
// ============================================================================

export const workflowOps = {
  start: (workflow: Workflow, now: number = Date.now()): Workflow => ({
    ...workflow,
    status: 'running',
    startedAt: now,
  }),

  complete: (workflow: Workflow, now: number = Date.now()): Workflow => ({
    ...workflow,
    status: 'completed',
    completedAt: now,
  }),

  pause: (workflow: Workflow, now: number = Date.now()): Workflow => ({
    ...workflow,
    status: 'paused',
    pausedAt: now,
  }),

  resume: (workflow: Workflow): Workflow => ({
    ...workflow,
    status: 'running',
    pausedAt: null,
  }),

  stop: (workflow: Workflow): Workflow => ({
    ...workflow,
    status: 'stopped',
  }),

  setError: (workflow: Workflow): Workflow => ({
    ...workflow,
    status: 'error',
  }),

  setWaiting: (workflow: Workflow): Workflow => ({
    ...workflow,
    status: 'waiting',
  }),

  setMode: (workflow: Workflow, mode: InputMode): Workflow => ({
    ...workflow,
    mode,
  }),

  advanceStep: (workflow: Workflow): Workflow => ({
    ...workflow,
    currentStepIndex: workflow.currentStepIndex + 1,
  }),

  setStepIndex: (workflow: Workflow, index: number): Workflow => ({
    ...workflow,
    currentStepIndex: index,
  }),

  updateStep: (workflow: Workflow, index: number, updates: Partial<Step>): Workflow => ({
    ...workflow,
    steps: workflow.steps.map((step, i) =>
      i === index ? { ...step, ...updates } : step
    ),
  }),

  addTelemetry: (workflow: Workflow, telemetry: Partial<Telemetry>): Workflow => ({
    ...workflow,
    telemetry: {
      tokensIn: workflow.telemetry.tokensIn + (telemetry.tokensIn ?? 0),
      tokensOut: workflow.telemetry.tokensOut + (telemetry.tokensOut ?? 0),
      cost: workflow.telemetry.cost + (telemetry.cost ?? 0),
      cached: (workflow.telemetry.cached ?? 0) + (telemetry.cached ?? 0),
    },
  }),
}

// ============================================================================
// Workflow Queries
// ============================================================================

export const workflowQueries = {
  getCurrentStep: (workflow: Workflow): Step | undefined =>
    workflow.steps[workflow.currentStepIndex],

  getStep: (workflow: Workflow, index: number): Step | undefined =>
    workflow.steps[index],

  hasMoreSteps: (workflow: Workflow): boolean =>
    workflow.currentStepIndex < workflow.steps.length - 1,

  isComplete: (workflow: Workflow): boolean =>
    workflow.status === 'completed',

  isFinal: (workflow: Workflow): boolean =>
    workflow.status === 'completed' ||
    workflow.status === 'stopped' ||
    workflow.status === 'error',

  canStart: (workflow: Workflow): boolean =>
    workflow.status === 'idle' || workflow.status === 'paused',

  canPause: (workflow: Workflow): boolean =>
    workflow.status === 'running' || workflow.status === 'waiting',

  canResume: (workflow: Workflow): boolean =>
    workflow.status === 'paused',

  getDuration: (workflow: Workflow, now: number = Date.now()): number => {
    if (!workflow.startedAt) return 0
    const endTime = workflow.completedAt ?? now
    return endTime - workflow.startedAt
  },

  getProgress: (workflow: Workflow): { current: number; total: number; percentage: number } => {
    const completedSteps = workflow.steps.filter(s =>
      s.state.status === 'completed' || s.state.status === 'skipped'
    ).length
    const total = workflow.steps.length
    const percentage = total > 0 ? Math.round((completedSteps / total) * 100) : 0

    return { current: completedSteps, total, percentage }
  },

  getCompletedStepIndices: (workflow: Workflow): number[] =>
    workflow.steps
      .map((step, index) => (step.state.status === 'completed' ? index : -1))
      .filter(index => index >= 0),

  getFailedStepIndices: (workflow: Workflow): number[] =>
    workflow.steps
      .map((step, index) => (step.state.status === 'error' ? index : -1))
      .filter(index => index >= 0),
}

// ============================================================================
// Type Guards
// ============================================================================

export const isWorkflow = (value: unknown): value is Workflow => {
  if (!value || typeof value !== 'object') return false
  const w = value as Workflow
  return (
    typeof w.id === 'string' &&
    typeof w.name === 'string' &&
    typeof w.status === 'string' &&
    Array.isArray(w.steps)
  )
}
