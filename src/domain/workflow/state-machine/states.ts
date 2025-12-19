/**
 * Workflow State Definitions
 *
 * Uses discriminated unions for type-safe state handling.
 * Each state carries only the data relevant to that state.
 */

import type { StepConfig, WaitReason } from '../../../shared/types'

// ============================================================================
// State Types (Discriminated Union)
// ============================================================================

export interface IdleState {
  readonly status: 'idle'
}

export interface RunningState {
  readonly status: 'running'
  readonly stepIndex: number
  readonly startedAt: number
  readonly iteration?: number
}

export interface WaitingState {
  readonly status: 'waiting'
  readonly stepIndex: number
  readonly waitingFor: WaitReason
  readonly startedWaitingAt: number
}

export interface PausedState {
  readonly status: 'paused'
  readonly stepIndex: number
  readonly pausedAt: number
  readonly pauseReason: string
}

export interface CompletedState {
  readonly status: 'completed'
  readonly completedAt: number
  readonly finalStepIndex: number
}

export interface StoppedState {
  readonly status: 'stopped'
  readonly stoppedAt: number
  readonly stoppedAtStep: number
  readonly reason: 'user' | 'error' | 'timeout'
}

export interface ErrorState {
  readonly status: 'error'
  readonly errorAt: number
  readonly stepIndex: number
  readonly error: WorkflowError
}

export interface WorkflowError {
  readonly code: string
  readonly message: string
  readonly recoverable: boolean
  readonly cause?: unknown
}

// ============================================================================
// Union Type
// ============================================================================

export type WorkflowState =
  | IdleState
  | RunningState
  | WaitingState
  | PausedState
  | CompletedState
  | StoppedState
  | ErrorState

// ============================================================================
// Type Guards
// ============================================================================

export const isIdle = (state: WorkflowState): state is IdleState =>
  state.status === 'idle'

export const isRunning = (state: WorkflowState): state is RunningState =>
  state.status === 'running'

export const isWaiting = (state: WorkflowState): state is WaitingState =>
  state.status === 'waiting'

export const isPaused = (state: WorkflowState): state is PausedState =>
  state.status === 'paused'

export const isCompleted = (state: WorkflowState): state is CompletedState =>
  state.status === 'completed'

export const isStopped = (state: WorkflowState): state is StoppedState =>
  state.status === 'stopped'

export const isError = (state: WorkflowState): state is ErrorState =>
  state.status === 'error'

export const isFinal = (state: WorkflowState): boolean =>
  state.status === 'completed' ||
  state.status === 'stopped' ||
  state.status === 'error'

export const canAcceptInput = (state: WorkflowState): boolean =>
  state.status === 'waiting'

export const canPause = (state: WorkflowState): boolean =>
  state.status === 'running' || state.status === 'waiting'

export const canResume = (state: WorkflowState): boolean =>
  state.status === 'paused'

// ============================================================================
// State Factories
// ============================================================================

export const createIdleState = (): IdleState => ({ status: 'idle' })

export const createRunningState = (
  stepIndex: number,
  startedAt: number = Date.now(),
  iteration?: number
): RunningState => ({
  status: 'running',
  stepIndex,
  startedAt,
  ...(iteration !== undefined && { iteration }),
})

export const createWaitingState = (
  stepIndex: number,
  waitingFor: WaitReason,
  startedWaitingAt: number = Date.now()
): WaitingState => ({
  status: 'waiting',
  stepIndex,
  waitingFor,
  startedWaitingAt,
})

export const createPausedState = (
  stepIndex: number,
  pauseReason: string,
  pausedAt: number = Date.now()
): PausedState => ({
  status: 'paused',
  stepIndex,
  pausedAt,
  pauseReason,
})

export const createCompletedState = (
  finalStepIndex: number,
  completedAt: number = Date.now()
): CompletedState => ({
  status: 'completed',
  completedAt,
  finalStepIndex,
})

export const createStoppedState = (
  stoppedAtStep: number,
  reason: 'user' | 'error' | 'timeout',
  stoppedAt: number = Date.now()
): StoppedState => ({
  status: 'stopped',
  stoppedAt,
  stoppedAtStep,
  reason,
})

export const createErrorState = (
  stepIndex: number,
  error: WorkflowError,
  errorAt: number = Date.now()
): ErrorState => ({
  status: 'error',
  errorAt,
  stepIndex,
  error,
})
