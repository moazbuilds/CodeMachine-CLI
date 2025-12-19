/**
 * Pure Workflow State Machine
 *
 * This is a PURE function - no side effects.
 * All I/O is represented as "effects" returned alongside the new state.
 * The application layer is responsible for executing effects.
 *
 * Benefits:
 * - 100% testable (just pass state + event, check output)
 * - Deterministic (same input = same output)
 * - Easy to reason about
 * - Can replay history
 */

import type { StepConfig } from '../../../shared/types'
import type { WorkflowEvent } from './events'
import {
  type WorkflowState,
  type WorkflowError,
  createIdleState,
  createRunningState,
  createWaitingState,
  createPausedState,
  createCompletedState,
  createStoppedState,
  createErrorState,
  isIdle,
  isRunning,
  isWaiting,
  isPaused,
  isFinal,
} from './states'

// ============================================================================
// Context (Read-only, passed to transitions)
// ============================================================================

export interface WorkflowContext {
  /** All steps in the workflow */
  readonly steps: StepConfig[]
  /** Current mode (user or autopilot) */
  readonly mode: 'user' | 'autopilot'
  /** Working directory */
  readonly cwd: string
  /** Current timestamp (injectable for testing) */
  readonly now: number
}

// ============================================================================
// Effects (Side effects to be executed by application layer)
// ============================================================================

export type Effect =
  | { readonly type: 'PERSIST_STATE'; readonly state: WorkflowState }
  | { readonly type: 'EXECUTE_STEP'; readonly stepIndex: number; readonly step: StepConfig }
  | { readonly type: 'REQUEST_INPUT'; readonly stepIndex: number; readonly prompt?: string }
  | { readonly type: 'EMIT_STATUS'; readonly status: WorkflowState['status']; readonly stepIndex?: number }
  | { readonly type: 'EMIT_STEP_COMPLETE'; readonly stepIndex: number; readonly output?: string }
  | { readonly type: 'EMIT_STEP_SKIP'; readonly stepIndex: number; readonly reason: string }
  | { readonly type: 'EMIT_STEP_ERROR'; readonly stepIndex: number; readonly error: WorkflowError }
  | { readonly type: 'EMIT_WORKFLOW_COMPLETE'; readonly finalStep: number }
  | { readonly type: 'EMIT_WORKFLOW_STOPPED'; readonly atStep: number; readonly reason: string }
  | { readonly type: 'LOG'; readonly message: string; readonly level: 'debug' | 'info' | 'warn' | 'error' }
  | { readonly type: 'ABORT_CURRENT_STEP' }
  | { readonly type: 'SAVE_PAUSE_STATE'; readonly stepIndex: number }
  | { readonly type: 'CLEAR_PAUSE_STATE' }

// ============================================================================
// Transition Result
// ============================================================================

export interface TransitionResult {
  /** The new state after transition */
  readonly state: WorkflowState
  /** Effects to be executed */
  readonly effects: Effect[]
  /** Whether the transition was valid */
  readonly valid: boolean
  /** Reason if transition was invalid */
  readonly invalidReason?: string
}

// ============================================================================
// Guards (Conditions for transitions)
// ============================================================================

const guards = {
  canStart: (state: WorkflowState): boolean =>
    isIdle(state) || isPaused(state),

  canComplete: (state: WorkflowState, stepIndex: number, ctx: WorkflowContext): boolean =>
    isRunning(state) && state.stepIndex === stepIndex,

  hasMoreSteps: (stepIndex: number, ctx: WorkflowContext): boolean =>
    stepIndex < ctx.steps.length - 1,

  canReceiveInput: (state: WorkflowState, stepIndex: number): boolean =>
    isWaiting(state) && state.stepIndex === stepIndex,

  canPause: (state: WorkflowState): boolean =>
    isRunning(state) || isWaiting(state),

  canResume: (state: WorkflowState): boolean =>
    isPaused(state),

  canStop: (state: WorkflowState): boolean =>
    !isFinal(state),
}

// ============================================================================
// Pure Transition Function
// ============================================================================

/**
 * Pure state transition function.
 *
 * @param state - Current state
 * @param event - Event to process
 * @param context - Read-only context
 * @returns New state and effects to execute
 */
export function transition(
  state: WorkflowState,
  event: WorkflowEvent,
  context: WorkflowContext
): TransitionResult {
  const effects: Effect[] = []

  // Helper to create invalid result
  const invalid = (reason: string): TransitionResult => ({
    state,
    effects: [{ type: 'LOG', message: `Invalid transition: ${reason}`, level: 'warn' }],
    valid: false,
    invalidReason: reason,
  })

  // Helper to create valid result
  const valid = (newState: WorkflowState, ...newEffects: Effect[]): TransitionResult => ({
    state: newState,
    effects: [
      { type: 'PERSIST_STATE', state: newState },
      ...newEffects,
    ],
    valid: true,
  })

  switch (event.type) {
    // ========================================================================
    // START
    // ========================================================================
    case 'START': {
      if (!guards.canStart(state)) {
        return invalid(`Cannot start from state: ${state.status}`)
      }

      const startStep = event.startFromStep ?? 0
      const step = context.steps[startStep]

      if (!step) {
        return invalid(`Invalid start step: ${startStep}`)
      }

      const newState = createRunningState(startStep, context.now)

      return valid(
        newState,
        { type: 'EMIT_STATUS', status: 'running', stepIndex: startStep },
        { type: 'CLEAR_PAUSE_STATE' },
        { type: 'EXECUTE_STEP', stepIndex: startStep, step }
      )
    }

    // ========================================================================
    // STEP_COMPLETE
    // ========================================================================
    case 'STEP_COMPLETE': {
      if (!guards.canComplete(state, event.stepIndex, context)) {
        return invalid(`Cannot complete step ${event.stepIndex} in state: ${state.status}`)
      }

      // Check if there are more steps
      if (guards.hasMoreSteps(event.stepIndex, context)) {
        // Move to waiting for input before next step
        const newState = createWaitingState(
          event.stepIndex,
          { type: 'user-input' },
          context.now
        )

        return valid(
          newState,
          { type: 'EMIT_STEP_COMPLETE', stepIndex: event.stepIndex, output: event.output },
          { type: 'EMIT_STATUS', status: 'waiting', stepIndex: event.stepIndex },
          { type: 'REQUEST_INPUT', stepIndex: event.stepIndex }
        )
      } else {
        // Workflow complete
        const newState = createCompletedState(event.stepIndex, context.now)

        return valid(
          newState,
          { type: 'EMIT_STEP_COMPLETE', stepIndex: event.stepIndex, output: event.output },
          { type: 'EMIT_STATUS', status: 'completed', stepIndex: event.stepIndex },
          { type: 'EMIT_WORKFLOW_COMPLETE', finalStep: event.stepIndex }
        )
      }
    }

    // ========================================================================
    // STEP_ERROR
    // ========================================================================
    case 'STEP_ERROR': {
      if (!isRunning(state)) {
        return invalid(`Cannot error step in state: ${state.status}`)
      }

      if (event.error.recoverable) {
        // Recoverable error - go to waiting for retry input
        const newState = createWaitingState(
          event.stepIndex,
          { type: 'error-recovery', error: event.error.message },
          context.now
        )

        return valid(
          newState,
          { type: 'EMIT_STEP_ERROR', stepIndex: event.stepIndex, error: event.error },
          { type: 'EMIT_STATUS', status: 'waiting', stepIndex: event.stepIndex },
          { type: 'REQUEST_INPUT', stepIndex: event.stepIndex, prompt: 'Retry or skip?' }
        )
      } else {
        // Non-recoverable error - stop workflow
        const newState = createErrorState(event.stepIndex, event.error, context.now)

        return valid(
          newState,
          { type: 'EMIT_STEP_ERROR', stepIndex: event.stepIndex, error: event.error },
          { type: 'EMIT_STATUS', status: 'error', stepIndex: event.stepIndex },
          { type: 'ABORT_CURRENT_STEP' }
        )
      }
    }

    // ========================================================================
    // WAIT_FOR_INPUT
    // ========================================================================
    case 'WAIT_FOR_INPUT': {
      if (!isRunning(state)) {
        return invalid(`Cannot wait for input in state: ${state.status}`)
      }

      const newState = createWaitingState(event.stepIndex, event.reason, context.now)

      return valid(
        newState,
        { type: 'EMIT_STATUS', status: 'waiting', stepIndex: event.stepIndex },
        { type: 'REQUEST_INPUT', stepIndex: event.stepIndex }
      )
    }

    // ========================================================================
    // INPUT_RECEIVED
    // ========================================================================
    case 'INPUT_RECEIVED': {
      if (!guards.canReceiveInput(state, event.stepIndex)) {
        return invalid(`Cannot receive input in state: ${state.status}`)
      }

      const nextStepIndex = event.stepIndex + 1
      const nextStep = context.steps[nextStepIndex]

      if (!nextStep) {
        // No more steps - workflow complete
        const newState = createCompletedState(event.stepIndex, context.now)

        return valid(
          newState,
          { type: 'EMIT_STATUS', status: 'completed', stepIndex: event.stepIndex },
          { type: 'EMIT_WORKFLOW_COMPLETE', finalStep: event.stepIndex }
        )
      }

      // Move to next step
      const newState = createRunningState(nextStepIndex, context.now)

      return valid(
        newState,
        { type: 'EMIT_STATUS', status: 'running', stepIndex: nextStepIndex },
        { type: 'EXECUTE_STEP', stepIndex: nextStepIndex, step: nextStep }
      )
    }

    // ========================================================================
    // SKIP
    // ========================================================================
    case 'SKIP': {
      if (!isRunning(state) && !isWaiting(state)) {
        return invalid(`Cannot skip in state: ${state.status}`)
      }

      const nextStepIndex = event.stepIndex + 1
      const nextStep = context.steps[nextStepIndex]

      if (!nextStep) {
        // No more steps - workflow complete
        const newState = createCompletedState(event.stepIndex, context.now)

        return valid(
          newState,
          { type: 'EMIT_STEP_SKIP', stepIndex: event.stepIndex, reason: event.reason },
          { type: 'EMIT_STATUS', status: 'completed', stepIndex: event.stepIndex },
          { type: 'EMIT_WORKFLOW_COMPLETE', finalStep: event.stepIndex }
        )
      }

      // Skip to next step
      const newState = createRunningState(nextStepIndex, context.now)

      return valid(
        newState,
        { type: 'EMIT_STEP_SKIP', stepIndex: event.stepIndex, reason: event.reason },
        { type: 'EMIT_STATUS', status: 'running', stepIndex: nextStepIndex },
        { type: 'EXECUTE_STEP', stepIndex: nextStepIndex, step: nextStep }
      )
    }

    // ========================================================================
    // LOOP
    // ========================================================================
    case 'LOOP': {
      if (!isWaiting(state) && !isRunning(state)) {
        return invalid(`Cannot loop in state: ${state.status}`)
      }

      const step = context.steps[event.stepIndex]
      if (!step) {
        return invalid(`Invalid step index for loop: ${event.stepIndex}`)
      }

      const newState = createRunningState(event.stepIndex, context.now, event.iteration)

      return valid(
        newState,
        { type: 'LOG', message: `Looping step ${event.stepIndex}, iteration ${event.iteration}`, level: 'info' },
        { type: 'EMIT_STATUS', status: 'running', stepIndex: event.stepIndex },
        { type: 'EXECUTE_STEP', stepIndex: event.stepIndex, step }
      )
    }

    // ========================================================================
    // PAUSE
    // ========================================================================
    case 'PAUSE': {
      if (!guards.canPause(state)) {
        return invalid(`Cannot pause in state: ${state.status}`)
      }

      const currentStep = isRunning(state) ? state.stepIndex : (state as any).stepIndex ?? 0
      const newState = createPausedState(currentStep, event.reason, context.now)

      return valid(
        newState,
        { type: 'EMIT_STATUS', status: 'paused', stepIndex: currentStep },
        { type: 'SAVE_PAUSE_STATE', stepIndex: currentStep },
        { type: 'ABORT_CURRENT_STEP' }
      )
    }

    // ========================================================================
    // RESUME
    // ========================================================================
    case 'RESUME': {
      if (!guards.canResume(state)) {
        return invalid(`Cannot resume in state: ${state.status}`)
      }

      const step = context.steps[event.fromStep]
      if (!step) {
        return invalid(`Invalid resume step: ${event.fromStep}`)
      }

      const newState = createRunningState(event.fromStep, context.now)

      return valid(
        newState,
        { type: 'CLEAR_PAUSE_STATE' },
        { type: 'EMIT_STATUS', status: 'running', stepIndex: event.fromStep },
        { type: 'EXECUTE_STEP', stepIndex: event.fromStep, step }
      )
    }

    // ========================================================================
    // STOP
    // ========================================================================
    case 'STOP': {
      if (!guards.canStop(state)) {
        return invalid(`Cannot stop in state: ${state.status}`)
      }

      const currentStep =
        isRunning(state) || isWaiting(state) || isPaused(state)
          ? (state as any).stepIndex
          : 0

      const newState = createStoppedState(currentStep, event.reason, context.now)

      return valid(
        newState,
        { type: 'ABORT_CURRENT_STEP' },
        { type: 'EMIT_STATUS', status: 'stopped', stepIndex: currentStep },
        { type: 'EMIT_WORKFLOW_STOPPED', atStep: currentStep, reason: event.reason }
      )
    }

    // ========================================================================
    // RECOVER
    // ========================================================================
    case 'RECOVER': {
      // Recovery is allowed from any non-final state
      if (isFinal(state)) {
        return invalid(`Cannot recover from final state: ${state.status}`)
      }

      const step = context.steps[event.fromStep]
      if (!step) {
        return invalid(`Invalid recovery step: ${event.fromStep}`)
      }

      const newState = createRunningState(event.fromStep, context.now)

      return valid(
        newState,
        { type: 'LOG', message: `Recovering from step ${event.fromStep}`, level: 'info' },
        { type: 'EMIT_STATUS', status: 'running', stepIndex: event.fromStep },
        { type: 'EXECUTE_STEP', stepIndex: event.fromStep, step }
      )
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = event
      return invalid(`Unknown event type: ${(event as any).type}`)
    }
  }
}

// ============================================================================
// State Machine Interpreter (Optional helper)
// ============================================================================

export interface StateMachineInterpreter {
  getState(): WorkflowState
  send(event: WorkflowEvent): TransitionResult
  subscribe(listener: (state: WorkflowState) => void): () => void
}

/**
 * Creates an interpreter that wraps the pure transition function
 * with mutable state and subscriptions.
 */
export function createInterpreter(
  initialState: WorkflowState,
  context: WorkflowContext
): StateMachineInterpreter {
  let currentState = initialState
  const listeners = new Set<(state: WorkflowState) => void>()

  return {
    getState: () => currentState,

    send: (event: WorkflowEvent) => {
      const result = transition(currentState, event, {
        ...context,
        now: Date.now(),
      })

      if (result.valid) {
        currentState = result.state
        for (const listener of listeners) {
          listener(currentState)
        }
      }

      return result
    },

    subscribe: (listener: (state: WorkflowState) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
