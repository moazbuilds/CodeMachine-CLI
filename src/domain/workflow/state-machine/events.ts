/**
 * State Machine Events
 *
 * Events that trigger state transitions.
 * Each event carries the minimum data needed for the transition.
 */

import type { ChainedPrompt, StepConfig, WaitReason } from '../../../shared/types'
import type { WorkflowError } from './states'

// ============================================================================
// Event Types (Discriminated Union)
// ============================================================================

export interface StartEvent {
  readonly type: 'START'
  readonly steps: StepConfig[]
  readonly startFromStep?: number
}

export interface StepCompleteEvent {
  readonly type: 'STEP_COMPLETE'
  readonly stepIndex: number
  readonly output?: string
  readonly duration: number
}

export interface StepErrorEvent {
  readonly type: 'STEP_ERROR'
  readonly stepIndex: number
  readonly error: WorkflowError
}

export interface WaitForInputEvent {
  readonly type: 'WAIT_FOR_INPUT'
  readonly stepIndex: number
  readonly reason: WaitReason
}

export interface InputReceivedEvent {
  readonly type: 'INPUT_RECEIVED'
  readonly stepIndex: number
  readonly input: string
  readonly source: 'user' | 'autopilot' | 'queue'
}

export interface SkipStepEvent {
  readonly type: 'SKIP'
  readonly stepIndex: number
  readonly reason: string
}

export interface LoopStepEvent {
  readonly type: 'LOOP'
  readonly stepIndex: number
  readonly iteration: number
}

export interface PauseEvent {
  readonly type: 'PAUSE'
  readonly reason: string
}

export interface ResumeEvent {
  readonly type: 'RESUME'
  readonly fromStep: number
}

export interface StopEvent {
  readonly type: 'STOP'
  readonly reason: 'user' | 'error' | 'timeout'
}

export interface RecoverEvent {
  readonly type: 'RECOVER'
  readonly fromStep: number
}

// ============================================================================
// Union Type
// ============================================================================

export type WorkflowEvent =
  | StartEvent
  | StepCompleteEvent
  | StepErrorEvent
  | WaitForInputEvent
  | InputReceivedEvent
  | SkipStepEvent
  | LoopStepEvent
  | PauseEvent
  | ResumeEvent
  | StopEvent
  | RecoverEvent

// ============================================================================
// Event Factories
// ============================================================================

export const createEvent = {
  start: (steps: StepConfig[], startFromStep?: number): StartEvent => ({
    type: 'START',
    steps,
    startFromStep,
  }),

  stepComplete: (
    stepIndex: number,
    duration: number,
    output?: string
  ): StepCompleteEvent => ({
    type: 'STEP_COMPLETE',
    stepIndex,
    output,
    duration,
  }),

  stepError: (stepIndex: number, error: WorkflowError): StepErrorEvent => ({
    type: 'STEP_ERROR',
    stepIndex,
    error,
  }),

  waitForInput: (stepIndex: number, reason: WaitReason): WaitForInputEvent => ({
    type: 'WAIT_FOR_INPUT',
    stepIndex,
    reason,
  }),

  inputReceived: (
    stepIndex: number,
    input: string,
    source: 'user' | 'autopilot' | 'queue'
  ): InputReceivedEvent => ({
    type: 'INPUT_RECEIVED',
    stepIndex,
    input,
    source,
  }),

  skip: (stepIndex: number, reason: string): SkipStepEvent => ({
    type: 'SKIP',
    stepIndex,
    reason,
  }),

  loop: (stepIndex: number, iteration: number): LoopStepEvent => ({
    type: 'LOOP',
    stepIndex,
    iteration,
  }),

  pause: (reason: string): PauseEvent => ({
    type: 'PAUSE',
    reason,
  }),

  resume: (fromStep: number): ResumeEvent => ({
    type: 'RESUME',
    fromStep,
  }),

  stop: (reason: 'user' | 'error' | 'timeout'): StopEvent => ({
    type: 'STOP',
    reason,
  }),

  recover: (fromStep: number): RecoverEvent => ({
    type: 'RECOVER',
    fromStep,
  }),
}

// ============================================================================
// Type Guards
// ============================================================================

export const isStartEvent = (event: WorkflowEvent): event is StartEvent =>
  event.type === 'START'

export const isStepCompleteEvent = (event: WorkflowEvent): event is StepCompleteEvent =>
  event.type === 'STEP_COMPLETE'

export const isStepErrorEvent = (event: WorkflowEvent): event is StepErrorEvent =>
  event.type === 'STEP_ERROR'

export const isInputEvent = (event: WorkflowEvent): event is InputReceivedEvent =>
  event.type === 'INPUT_RECEIVED'

export const isControlEvent = (event: WorkflowEvent): boolean =>
  event.type === 'PAUSE' ||
  event.type === 'RESUME' ||
  event.type === 'STOP' ||
  event.type === 'SKIP'
