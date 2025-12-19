/**
 * Step Entity
 *
 * Represents a single step in a workflow.
 * Immutable - all modifications return new instances.
 */

import type {
  AgentId,
  StepId,
  SessionId,
  MonitoringId,
  Telemetry,
  ChainedPrompt,
  createStepId,
  createAgentId,
} from '../../../shared/types'

// ============================================================================
// Step State (Discriminated Union)
// ============================================================================

export type StepStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'skipped' | 'error'

export interface StepState {
  readonly status: StepStatus
  readonly startedAt: number | null
  readonly completedAt: number | null
  readonly sessionId: SessionId | null
  readonly monitoringId: MonitoringId | null
  readonly output: string | null
  readonly error: StepError | null
  readonly telemetry: Telemetry
  readonly iteration: number
  readonly chainedPrompts: ChainedPromptState | null
}

export interface ChainedPromptState {
  readonly prompts: ChainedPrompt[]
  readonly currentIndex: number
  readonly completedIndices: number[]
}

export interface StepError {
  readonly code: string
  readonly message: string
  readonly recoverable: boolean
}

// ============================================================================
// Step Entity
// ============================================================================

export interface Step {
  readonly id: StepId
  readonly index: number
  readonly agentId: AgentId
  readonly agentName: string
  readonly promptPath: string | string[]
  readonly model: string | null
  readonly engine: string | null
  readonly tracks: string[]
  readonly conditions: string[]
  readonly state: StepState
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createInitialStepState = (): StepState => ({
  status: 'pending',
  startedAt: null,
  completedAt: null,
  sessionId: null,
  monitoringId: null,
  output: null,
  error: null,
  telemetry: { tokensIn: 0, tokensOut: 0, cost: 0 },
  iteration: 0,
  chainedPrompts: null,
})

export const createStep = (
  index: number,
  config: {
    agentId: string
    agentName: string
    promptPath: string | string[]
    model?: string
    engine?: string
    tracks?: string[]
    conditions?: string[]
  }
): Step => ({
  id: `step_${index}` as StepId,
  index,
  agentId: config.agentId as AgentId,
  agentName: config.agentName,
  promptPath: config.promptPath,
  model: config.model ?? null,
  engine: config.engine ?? null,
  tracks: config.tracks ?? [],
  conditions: config.conditions ?? [],
  state: createInitialStepState(),
})

// ============================================================================
// Step State Operations (Immutable)
// ============================================================================

export const stepStateOps = {
  start: (state: StepState, now: number = Date.now()): StepState => ({
    ...state,
    status: 'running',
    startedAt: now,
  }),

  setSession: (
    state: StepState,
    sessionId: SessionId,
    monitoringId: MonitoringId
  ): StepState => ({
    ...state,
    sessionId,
    monitoringId,
  }),

  setWaiting: (state: StepState): StepState => ({
    ...state,
    status: 'waiting',
  }),

  complete: (
    state: StepState,
    output: string | null,
    now: number = Date.now()
  ): StepState => ({
    ...state,
    status: 'completed',
    completedAt: now,
    output,
  }),

  skip: (state: StepState, now: number = Date.now()): StepState => ({
    ...state,
    status: 'skipped',
    completedAt: now,
  }),

  setError: (state: StepState, error: StepError): StepState => ({
    ...state,
    status: 'error',
    error,
  }),

  addTelemetry: (state: StepState, telemetry: Partial<Telemetry>): StepState => ({
    ...state,
    telemetry: {
      tokensIn: state.telemetry.tokensIn + (telemetry.tokensIn ?? 0),
      tokensOut: state.telemetry.tokensOut + (telemetry.tokensOut ?? 0),
      cost: state.telemetry.cost + (telemetry.cost ?? 0),
      cached: (state.telemetry.cached ?? 0) + (telemetry.cached ?? 0),
    },
  }),

  incrementIteration: (state: StepState): StepState => ({
    ...state,
    iteration: state.iteration + 1,
  }),

  setChainedPrompts: (state: StepState, prompts: ChainedPrompt[]): StepState => ({
    ...state,
    chainedPrompts: {
      prompts,
      currentIndex: 0,
      completedIndices: [],
    },
  }),

  advanceChain: (state: StepState): StepState => {
    if (!state.chainedPrompts) return state

    const currentIndex = state.chainedPrompts.currentIndex
    return {
      ...state,
      chainedPrompts: {
        ...state.chainedPrompts,
        currentIndex: currentIndex + 1,
        completedIndices: [...state.chainedPrompts.completedIndices, currentIndex],
      },
    }
  },

  reset: (state: StepState): StepState => ({
    ...createInitialStepState(),
    iteration: state.iteration,
  }),
}

// ============================================================================
// Step Operations (Immutable)
// ============================================================================

export const stepOps = {
  updateState: (step: Step, updates: Partial<StepState>): Step => ({
    ...step,
    state: { ...step.state, ...updates },
  }),

  start: (step: Step, now?: number): Step => ({
    ...step,
    state: stepStateOps.start(step.state, now),
  }),

  complete: (step: Step, output: string | null, now?: number): Step => ({
    ...step,
    state: stepStateOps.complete(step.state, output, now),
  }),

  skip: (step: Step, now?: number): Step => ({
    ...step,
    state: stepStateOps.skip(step.state, now),
  }),

  setError: (step: Step, error: StepError): Step => ({
    ...step,
    state: stepStateOps.setError(step.state, error),
  }),

  setSession: (step: Step, sessionId: SessionId, monitoringId: MonitoringId): Step => ({
    ...step,
    state: stepStateOps.setSession(step.state, sessionId, monitoringId),
  }),
}

// ============================================================================
// Step Queries
// ============================================================================

export const stepQueries = {
  isComplete: (step: Step): boolean =>
    step.state.status === 'completed' || step.state.status === 'skipped',

  isRunning: (step: Step): boolean =>
    step.state.status === 'running',

  isWaiting: (step: Step): boolean =>
    step.state.status === 'waiting',

  isPending: (step: Step): boolean =>
    step.state.status === 'pending',

  hasError: (step: Step): boolean =>
    step.state.status === 'error',

  getDuration: (step: Step, now: number = Date.now()): number => {
    if (!step.state.startedAt) return 0
    const endTime = step.state.completedAt ?? now
    return endTime - step.state.startedAt
  },

  hasMoreChains: (step: Step): boolean => {
    if (!step.state.chainedPrompts) return false
    return step.state.chainedPrompts.currentIndex < step.state.chainedPrompts.prompts.length
  },

  getCurrentChainPrompt: (step: Step): ChainedPrompt | null => {
    if (!step.state.chainedPrompts) return null
    const { prompts, currentIndex } = step.state.chainedPrompts
    return prompts[currentIndex] ?? null
  },

  getChainProgress: (step: Step): { current: number; total: number } | null => {
    if (!step.state.chainedPrompts) return null
    const { prompts, currentIndex } = step.state.chainedPrompts
    return { current: currentIndex, total: prompts.length }
  },

  canResume: (step: Step): boolean =>
    step.state.sessionId !== null &&
    (step.state.status === 'waiting' || step.state.status === 'error'),
}

// ============================================================================
// Type Guards
// ============================================================================

export const isStep = (value: unknown): value is Step => {
  if (!value || typeof value !== 'object') return false
  const s = value as Step
  return (
    typeof s.id === 'string' &&
    typeof s.index === 'number' &&
    typeof s.agentId === 'string' &&
    typeof s.agentName === 'string'
  )
}
