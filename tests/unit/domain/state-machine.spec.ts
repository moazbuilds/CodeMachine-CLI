import { describe, expect, it, beforeEach } from 'bun:test'

import {
  transition,
  createIdleState,
  createRunningState,
  createWaitingState,
  createPausedState,
  createCompletedState,
  createStoppedState,
  createErrorState,
} from '../../../src/domain/workflow/state-machine/machine'
import type {
  WorkflowState,
  WorkflowContext,
} from '../../../src/domain/workflow/state-machine/states'
import type { WorkflowEvent } from '../../../src/domain/workflow/state-machine/events'

// ============================================================================
// Test Helpers
// ============================================================================

const createTestContext = (overrides: Partial<WorkflowContext> = {}): WorkflowContext => ({
  workflowId: 'test-workflow',
  totalSteps: 3,
  mode: 'manual',
  ...overrides,
})

const createSteps = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    index: i,
    name: `Step ${i}`,
    completed: false,
  }))

// ============================================================================
// Tests
// ============================================================================

describe('WorkflowStateMachine', () => {
  describe('State Creation', () => {
    it('creates idle state correctly', () => {
      const state = createIdleState()
      expect(state.status).toBe('idle')
    })

    it('creates running state with step index', () => {
      const state = createRunningState(1)
      expect(state.status).toBe('running')
      expect(state.stepIndex).toBe(1)
      expect(state.startedAt).toBeLessThanOrEqual(Date.now())
    })

    it('creates waiting state with reason', () => {
      const state = createWaitingState(0, { type: 'user-input', prompt: 'Enter value' })
      expect(state.status).toBe('waiting')
      expect(state.stepIndex).toBe(0)
      expect(state.waitingFor.type).toBe('user-input')
    })

    it('creates paused state', () => {
      const state = createPausedState(1)
      expect(state.status).toBe('paused')
      expect(state.stepIndex).toBe(1)
      expect(state.pausedAt).toBeLessThanOrEqual(Date.now())
    })

    it('creates completed state', () => {
      const state = createCompletedState()
      expect(state.status).toBe('completed')
      expect(state.completedAt).toBeLessThanOrEqual(Date.now())
    })

    it('creates stopped state with reason', () => {
      const state = createStoppedState('user-requested')
      expect(state.status).toBe('stopped')
      expect(state.reason).toBe('user-requested')
      expect(state.stoppedAt).toBeLessThanOrEqual(Date.now())
    })

    it('creates error state', () => {
      const error = new Error('Test error')
      const state = createErrorState(error, 1)
      expect(state.status).toBe('error')
      expect(state.error).toBe(error)
      expect(state.stepIndex).toBe(1)
    })
  })

  describe('Transitions from IDLE', () => {
    let idleState: WorkflowState
    let context: WorkflowContext

    beforeEach(() => {
      idleState = createIdleState()
      context = createTestContext()
    })

    it('transitions to running on START event', () => {
      const event: WorkflowEvent = {
        type: 'START',
        steps: createSteps(3),
        startIndex: 0,
      }

      const result = transition(idleState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('running')
      if (result.state.status === 'running') {
        expect(result.state.stepIndex).toBe(0)
      }
    })

    it('transitions to running at specified start index', () => {
      const event: WorkflowEvent = {
        type: 'START',
        steps: createSteps(3),
        startIndex: 1,
      }

      const result = transition(idleState, event, context)

      expect(result.valid).toBe(true)
      if (result.state.status === 'running') {
        expect(result.state.stepIndex).toBe(1)
      }
    })

    it('emits PERSIST_STATE and EXECUTE_STEP effects on start', () => {
      const event: WorkflowEvent = {
        type: 'START',
        steps: createSteps(3),
        startIndex: 0,
      }

      const result = transition(idleState, event, context)

      expect(result.effects).toContainEqual(
        expect.objectContaining({ type: 'PERSIST_STATE' })
      )
      expect(result.effects).toContainEqual(
        expect.objectContaining({ type: 'EXECUTE_STEP', stepIndex: 0 })
      )
    })

    it('rejects invalid events from idle state', () => {
      const event: WorkflowEvent = { type: 'STEP_COMPLETE', output: 'test' }

      const result = transition(idleState, event, context)

      expect(result.valid).toBe(false)
      expect(result.state).toBe(idleState) // State unchanged
    })
  })

  describe('Transitions from RUNNING', () => {
    let runningState: WorkflowState
    let context: WorkflowContext

    beforeEach(() => {
      runningState = createRunningState(0)
      context = createTestContext()
    })

    it('transitions to waiting on WAIT_FOR_INPUT event', () => {
      const event: WorkflowEvent = {
        type: 'WAIT_FOR_INPUT',
        prompt: 'Enter value',
      }

      const result = transition(runningState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('waiting')
      if (result.state.status === 'waiting') {
        expect(result.state.waitingFor.type).toBe('user-input')
      }
    })

    it('transitions to next step on STEP_COMPLETE event', () => {
      const event: WorkflowEvent = {
        type: 'STEP_COMPLETE',
        output: 'Step completed',
      }

      const result = transition(runningState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('running')
      if (result.state.status === 'running') {
        expect(result.state.stepIndex).toBe(1)
      }
    })

    it('transitions to completed when last step completes', () => {
      const lastStepState = createRunningState(2) // Last step (index 2 of 3)
      const event: WorkflowEvent = {
        type: 'STEP_COMPLETE',
        output: 'Final step done',
      }

      const result = transition(lastStepState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('completed')
    })

    it('transitions to error on STEP_ERROR event', () => {
      const event: WorkflowEvent = {
        type: 'STEP_ERROR',
        error: new Error('Step failed'),
      }

      const result = transition(runningState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('error')
    })

    it('transitions to paused on PAUSE event', () => {
      const event: WorkflowEvent = { type: 'PAUSE' }

      const result = transition(runningState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('paused')
    })

    it('transitions to stopped on STOP event', () => {
      const event: WorkflowEvent = {
        type: 'STOP',
        reason: 'user-requested',
      }

      const result = transition(runningState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('stopped')
    })

    it('skips to next step on SKIP event', () => {
      const event: WorkflowEvent = { type: 'SKIP' }

      const result = transition(runningState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('running')
      if (result.state.status === 'running') {
        expect(result.state.stepIndex).toBe(1)
      }
    })

    it('completes workflow when skipping last step', () => {
      const lastStepState = createRunningState(2)
      const event: WorkflowEvent = { type: 'SKIP' }

      const result = transition(lastStepState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('completed')
    })
  })

  describe('Transitions from WAITING', () => {
    let waitingState: WorkflowState
    let context: WorkflowContext

    beforeEach(() => {
      waitingState = createWaitingState(0, { type: 'user-input', prompt: 'Enter value' })
      context = createTestContext()
    })

    it('transitions to running on INPUT_RECEIVED event', () => {
      const event: WorkflowEvent = {
        type: 'INPUT_RECEIVED',
        input: 'user input',
        source: 'user',
      }

      const result = transition(waitingState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('running')
    })

    it('transitions to paused on PAUSE event', () => {
      const event: WorkflowEvent = { type: 'PAUSE' }

      const result = transition(waitingState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('paused')
    })

    it('transitions to stopped on STOP event', () => {
      const event: WorkflowEvent = { type: 'STOP', reason: 'user-requested' }

      const result = transition(waitingState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('stopped')
    })

    it('skips to next step on SKIP event', () => {
      const event: WorkflowEvent = { type: 'SKIP' }

      const result = transition(waitingState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('running')
    })

    it('switches mode on MODE_SWITCH event', () => {
      const event: WorkflowEvent = { type: 'MODE_SWITCH', to: 'autopilot' }

      const result = transition(waitingState, event, context)

      expect(result.valid).toBe(true)
      expect(result.effects).toContainEqual(
        expect.objectContaining({ type: 'SWITCH_MODE', to: 'autopilot' })
      )
    })
  })

  describe('Transitions from PAUSED', () => {
    let pausedState: WorkflowState
    let context: WorkflowContext

    beforeEach(() => {
      pausedState = createPausedState(1)
      context = createTestContext()
    })

    it('transitions to running on RESUME event', () => {
      const event: WorkflowEvent = { type: 'RESUME' }

      const result = transition(pausedState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('running')
      if (result.state.status === 'running') {
        expect(result.state.stepIndex).toBe(1)
      }
    })

    it('transitions to stopped on STOP event', () => {
      const event: WorkflowEvent = { type: 'STOP', reason: 'user-requested' }

      const result = transition(pausedState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('stopped')
    })

    it('rejects START event from paused state', () => {
      const event: WorkflowEvent = {
        type: 'START',
        steps: createSteps(3),
        startIndex: 0,
      }

      const result = transition(pausedState, event, context)

      expect(result.valid).toBe(false)
    })
  })

  describe('Transitions from COMPLETED', () => {
    let completedState: WorkflowState
    let context: WorkflowContext

    beforeEach(() => {
      completedState = createCompletedState()
      context = createTestContext()
    })

    it('transitions to idle on RESET event', () => {
      const event: WorkflowEvent = { type: 'RESET' }

      const result = transition(completedState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('idle')
    })

    it('rejects most events from completed state', () => {
      const events: WorkflowEvent[] = [
        { type: 'START', steps: createSteps(3), startIndex: 0 },
        { type: 'STEP_COMPLETE', output: 'test' },
        { type: 'PAUSE' },
        { type: 'RESUME' },
      ]

      for (const event of events) {
        const result = transition(completedState, event, context)
        expect(result.valid).toBe(false)
      }
    })
  })

  describe('Transitions from STOPPED', () => {
    let stoppedState: WorkflowState
    let context: WorkflowContext

    beforeEach(() => {
      stoppedState = createStoppedState('user-requested')
      context = createTestContext()
    })

    it('transitions to idle on RESET event', () => {
      const event: WorkflowEvent = { type: 'RESET' }

      const result = transition(stoppedState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('idle')
    })

    it('rejects most events from stopped state', () => {
      const events: WorkflowEvent[] = [
        { type: 'STEP_COMPLETE', output: 'test' },
        { type: 'PAUSE' },
        { type: 'RESUME' },
      ]

      for (const event of events) {
        const result = transition(stoppedState, event, context)
        expect(result.valid).toBe(false)
      }
    })
  })

  describe('Transitions from ERROR', () => {
    let errorState: WorkflowState
    let context: WorkflowContext

    beforeEach(() => {
      errorState = createErrorState(new Error('Test error'), 1)
      context = createTestContext()
    })

    it('transitions to idle on RESET event', () => {
      const event: WorkflowEvent = { type: 'RESET' }

      const result = transition(errorState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('idle')
    })

    it('can retry from error state on RETRY event', () => {
      const event: WorkflowEvent = { type: 'RETRY' }

      const result = transition(errorState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('running')
      if (result.state.status === 'running') {
        expect(result.state.stepIndex).toBe(1) // Same step
      }
    })
  })

  describe('Effects Generation', () => {
    it('generates PERSIST_STATE effect on state transitions', () => {
      const idleState = createIdleState()
      const context = createTestContext()
      const event: WorkflowEvent = {
        type: 'START',
        steps: createSteps(3),
        startIndex: 0,
      }

      const result = transition(idleState, event, context)

      const persistEffect = result.effects.find(e => e.type === 'PERSIST_STATE')
      expect(persistEffect).toBeDefined()
    })

    it('generates EMIT_EVENT effect for significant transitions', () => {
      const runningState = createRunningState(0)
      const context = createTestContext()
      const event: WorkflowEvent = { type: 'PAUSE' }

      const result = transition(runningState, event, context)

      const emitEffect = result.effects.find(e => e.type === 'EMIT_EVENT')
      expect(emitEffect).toBeDefined()
    })

    it('generates EXECUTE_STEP effect when moving to next step', () => {
      const runningState = createRunningState(0)
      const context = createTestContext()
      const event: WorkflowEvent = { type: 'STEP_COMPLETE', output: 'done' }

      const result = transition(runningState, event, context)

      const executeEffect = result.effects.find(e => e.type === 'EXECUTE_STEP')
      expect(executeEffect).toBeDefined()
      if (executeEffect?.type === 'EXECUTE_STEP') {
        expect(executeEffect.stepIndex).toBe(1)
      }
    })

    it('generates REQUEST_INPUT effect when waiting for input', () => {
      const runningState = createRunningState(0)
      const context = createTestContext()
      const event: WorkflowEvent = {
        type: 'WAIT_FOR_INPUT',
        prompt: 'Enter value',
      }

      const result = transition(runningState, event, context)

      const inputEffect = result.effects.find(e => e.type === 'REQUEST_INPUT')
      expect(inputEffect).toBeDefined()
    })
  })

  describe('Mode Handling', () => {
    it('handles MODE_SWITCH in waiting state', () => {
      const waitingState = createWaitingState(0, { type: 'user-input', prompt: 'test' })
      const context = createTestContext({ mode: 'manual' })
      const event: WorkflowEvent = { type: 'MODE_SWITCH', to: 'autopilot' }

      const result = transition(waitingState, event, context)

      expect(result.valid).toBe(true)
      expect(result.effects).toContainEqual(
        expect.objectContaining({ type: 'SWITCH_MODE', to: 'autopilot' })
      )
    })

    it('handles MODE_SWITCH in running state', () => {
      const runningState = createRunningState(0)
      const context = createTestContext({ mode: 'manual' })
      const event: WorkflowEvent = { type: 'MODE_SWITCH', to: 'autopilot' }

      const result = transition(runningState, event, context)

      expect(result.valid).toBe(true)
      expect(result.effects).toContainEqual(
        expect.objectContaining({ type: 'SWITCH_MODE', to: 'autopilot' })
      )
    })
  })

  describe('Loop Handling', () => {
    it('handles LOOP event by staying on current step', () => {
      const runningState = createRunningState(1)
      const context = createTestContext()
      const event: WorkflowEvent = { type: 'LOOP' }

      const result = transition(runningState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('running')
      if (result.state.status === 'running') {
        expect(result.state.stepIndex).toBe(1) // Same step
      }
    })

    it('handles LOOP event from waiting state', () => {
      const waitingState = createWaitingState(1, { type: 'user-input', prompt: 'test' })
      const context = createTestContext()
      const event: WorkflowEvent = { type: 'LOOP' }

      const result = transition(waitingState, event, context)

      expect(result.valid).toBe(true)
      expect(result.state.status).toBe('running')
    })
  })

  describe('Pure Function Properties', () => {
    it('does not mutate input state', () => {
      const originalState = createIdleState()
      const stateCopy = { ...originalState }
      const context = createTestContext()
      const event: WorkflowEvent = {
        type: 'START',
        steps: createSteps(3),
        startIndex: 0,
      }

      transition(originalState, event, context)

      expect(originalState).toEqual(stateCopy)
    })

    it('returns same state reference when transition is invalid', () => {
      const idleState = createIdleState()
      const context = createTestContext()
      const event: WorkflowEvent = { type: 'STEP_COMPLETE', output: 'test' }

      const result = transition(idleState, event, context)

      expect(result.state).toBe(idleState)
    })

    it('produces deterministic results for same inputs', () => {
      const state = createIdleState()
      const context = createTestContext()
      const event: WorkflowEvent = {
        type: 'START',
        steps: createSteps(3),
        startIndex: 0,
      }

      const result1 = transition(state, event, context)
      const result2 = transition(state, event, context)

      expect(result1.state.status).toBe(result2.state.status)
      expect(result1.valid).toBe(result2.valid)
      expect(result1.effects.length).toBe(result2.effects.length)
    })
  })
})
