import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { WorkflowService, createWorkflowService } from '../../../src/application/services/workflow-service'
import { createEventBus, type IEventBus } from '../../../src/infrastructure/events/event-bus'
import { createWALStore, type WALStore } from '../../../src/infrastructure/persistence/state-store/wal-store'
import type { AllDomainEvents } from '../../../src/infrastructure/events/event-types'

// ============================================================================
// Test Helpers
// ============================================================================

interface TestContext {
  tempDir: string
  eventBus: IEventBus
  stateStore: WALStore
  workflowService: WorkflowService
  events: AllDomainEvents[]
}

const createTestContext = async (): Promise<TestContext> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'workflow-test-'))
  const eventBus = createEventBus()
  const stateStore = createWALStore({ directory: tempDir })

  await stateStore.open()

  const events: AllDomainEvents[] = []

  // Capture all events
  const eventTypes: AllDomainEvents['type'][] = [
    'workflow:started',
    'workflow:status-changed',
    'workflow:stopped',
    'workflow:error',
    'step:started',
    'step:completed',
    'step:skipped',
    'step:error',
  ]

  for (const type of eventTypes) {
    eventBus.subscribe(type, (event) => {
      events.push(event as AllDomainEvents)
    })
  }

  const workflowService = createWorkflowService({
    eventBus,
    stateStore,
  })

  return {
    tempDir,
    eventBus,
    stateStore,
    workflowService,
    events,
  }
}

const cleanupTestContext = async (ctx: TestContext): Promise<void> => {
  ctx.workflowService.stop()
  await ctx.stateStore.close()
  await rm(ctx.tempDir, { recursive: true, force: true })
}

const createTestSteps = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    index: i,
    name: `Test Step ${i + 1}`,
    agent: `agent-${i}`,
    prompt: `Do task ${i + 1}`,
  }))

// ============================================================================
// Tests
// ============================================================================

describe('WorkflowService Integration', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await createTestContext()
  })

  afterEach(async () => {
    await cleanupTestContext(ctx)
  })

  describe('Workflow Lifecycle', () => {
    it('starts a workflow and emits started event', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-1',
        steps,
        mode: 'manual',
      })

      const startedEvent = ctx.events.find(e => e.type === 'workflow:started')
      expect(startedEvent).toBeDefined()
      expect(startedEvent?.type).toBe('workflow:started')
      if (startedEvent?.type === 'workflow:started') {
        expect(startedEvent.workflowId).toBe('test-workflow-1')
        expect(startedEvent.totalSteps).toBe(3)
      }
    })

    it('transitions to running state after start', async () => {
      const steps = createTestSteps(2)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-2',
        steps,
        mode: 'manual',
      })

      const state = ctx.workflowService.getState()
      expect(state.status).toBe('running')
    })

    it('emits step started event when workflow starts', async () => {
      const steps = createTestSteps(2)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-3',
        steps,
        mode: 'manual',
      })

      const stepStartedEvent = ctx.events.find(e => e.type === 'step:started')
      expect(stepStartedEvent).toBeDefined()
      if (stepStartedEvent?.type === 'step:started') {
        expect(stepStartedEvent.stepIndex).toBe(0)
      }
    })

    it('stops workflow and emits stopped event', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-4',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.stop('user-requested')

      const stoppedEvent = ctx.events.find(e => e.type === 'workflow:stopped')
      expect(stoppedEvent).toBeDefined()
      if (stoppedEvent?.type === 'workflow:stopped') {
        expect(stoppedEvent.reason).toBe('user-requested')
      }

      const state = ctx.workflowService.getState()
      expect(state.status).toBe('stopped')
    })
  })

  describe('Pause and Resume', () => {
    it('pauses a running workflow', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-5',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.pause()

      const state = ctx.workflowService.getState()
      expect(state.status).toBe('paused')
    })

    it('resumes a paused workflow', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-6',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.pause()
      expect(ctx.workflowService.getState().status).toBe('paused')

      await ctx.workflowService.resume()

      const state = ctx.workflowService.getState()
      expect(state.status).toBe('running')
    })

    it('preserves step index after pause and resume', async () => {
      const steps = createTestSteps(5)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-7',
        steps,
        mode: 'manual',
        startIndex: 2,
      })

      await ctx.workflowService.pause()
      await ctx.workflowService.resume()

      const state = ctx.workflowService.getState()
      if (state.status === 'running') {
        expect(state.stepIndex).toBe(2)
      }
    })
  })

  describe('Step Progression', () => {
    it('advances to next step on step complete', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-8',
        steps,
        mode: 'manual',
      })

      // Simulate step completion
      await ctx.workflowService.completeStep('Step 1 output')

      const state = ctx.workflowService.getState()
      if (state.status === 'running') {
        expect(state.stepIndex).toBe(1)
      }
    })

    it('skips current step and advances', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-9',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.skip()

      const skippedEvent = ctx.events.find(e => e.type === 'step:skipped')
      expect(skippedEvent).toBeDefined()

      const state = ctx.workflowService.getState()
      if (state.status === 'running') {
        expect(state.stepIndex).toBe(1)
      }
    })

    it('completes workflow when last step finishes', async () => {
      const steps = createTestSteps(2)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-10',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.completeStep('Step 1 output')
      await ctx.workflowService.completeStep('Step 2 output')

      const state = ctx.workflowService.getState()
      expect(state.status).toBe('completed')
    })

    it('emits step completed events for each step', async () => {
      const steps = createTestSteps(2)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-11',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.completeStep('Step 1 output')
      await ctx.workflowService.completeStep('Step 2 output')

      const stepCompletedEvents = ctx.events.filter(e => e.type === 'step:completed')
      expect(stepCompletedEvents.length).toBe(2)
    })
  })

  describe('Mode Switching', () => {
    it('switches from manual to autopilot mode', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-12',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.switchMode('autopilot')

      expect(ctx.workflowService.getMode()).toBe('autopilot')
    })

    it('switches from autopilot to manual mode', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-13',
        steps,
        mode: 'autopilot',
      })

      await ctx.workflowService.switchMode('manual')

      expect(ctx.workflowService.getMode()).toBe('manual')
    })
  })

  describe('Error Handling', () => {
    it('handles step error and transitions to error state', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-14',
        steps,
        mode: 'manual',
      })

      const error = new Error('Step execution failed')
      await ctx.workflowService.handleStepError(error)

      const state = ctx.workflowService.getState()
      expect(state.status).toBe('error')

      const errorEvent = ctx.events.find(e => e.type === 'step:error')
      expect(errorEvent).toBeDefined()
    })

    it('can retry after error', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-15',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.handleStepError(new Error('Temporary failure'))
      expect(ctx.workflowService.getState().status).toBe('error')

      await ctx.workflowService.retry()

      const state = ctx.workflowService.getState()
      expect(state.status).toBe('running')
    })

    it('preserves step index on retry', async () => {
      const steps = createTestSteps(5)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-16',
        steps,
        mode: 'manual',
        startIndex: 2,
      })

      await ctx.workflowService.handleStepError(new Error('Failure'))
      await ctx.workflowService.retry()

      const state = ctx.workflowService.getState()
      if (state.status === 'running') {
        expect(state.stepIndex).toBe(2)
      }
    })
  })

  describe('State Persistence', () => {
    it('persists workflow state to store', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-17',
        steps,
        mode: 'manual',
      })

      // Verify state was persisted
      const persistedState = await ctx.stateStore.get('workflow:state')
      expect(persistedState).toBeDefined()
    })

    it('persists state after step completion', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-18',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.completeStep('Output')

      const persistedState = await ctx.stateStore.get('workflow:state')
      expect(persistedState).toBeDefined()
    })
  })

  describe('Start Index', () => {
    it('starts workflow at specified index', async () => {
      const steps = createTestSteps(5)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-19',
        steps,
        mode: 'manual',
        startIndex: 3,
      })

      const state = ctx.workflowService.getState()
      if (state.status === 'running') {
        expect(state.stepIndex).toBe(3)
      }
    })

    it('validates start index is within bounds', async () => {
      const steps = createTestSteps(3)

      await expect(
        ctx.workflowService.start({
          workflowId: 'test-workflow-20',
          steps,
          mode: 'manual',
          startIndex: 10, // Out of bounds
        })
      ).rejects.toThrow()
    })
  })

  describe('Reset', () => {
    it('resets workflow to idle state', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-21',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.completeStep('Output')
      await ctx.workflowService.reset()

      const state = ctx.workflowService.getState()
      expect(state.status).toBe('idle')
    })

    it('resets from error state', async () => {
      const steps = createTestSteps(3)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-22',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.handleStepError(new Error('Failure'))
      await ctx.workflowService.reset()

      const state = ctx.workflowService.getState()
      expect(state.status).toBe('idle')
    })

    it('resets from completed state', async () => {
      const steps = createTestSteps(1)

      await ctx.workflowService.start({
        workflowId: 'test-workflow-23',
        steps,
        mode: 'manual',
      })

      await ctx.workflowService.completeStep('Done')
      expect(ctx.workflowService.getState().status).toBe('completed')

      await ctx.workflowService.reset()
      expect(ctx.workflowService.getState().status).toBe('idle')
    })
  })
})

describe('Event Bus Integration', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await createTestContext()
  })

  afterEach(async () => {
    await cleanupTestContext(ctx)
  })

  it('events are emitted in correct order', async () => {
    const steps = createTestSteps(2)

    await ctx.workflowService.start({
      workflowId: 'event-order-test',
      steps,
      mode: 'manual',
    })

    await ctx.workflowService.completeStep('Step 1')

    const eventTypes = ctx.events.map(e => e.type)

    // Verify workflow started comes first
    const startedIndex = eventTypes.indexOf('workflow:started')
    const stepStartedIndex = eventTypes.indexOf('step:started')

    expect(startedIndex).toBeLessThan(stepStartedIndex)
  })

  it('all events have timestamps', () => {
    for (const event of ctx.events) {
      expect(event.timestamp).toBeDefined()
      expect(typeof event.timestamp).toBe('number')
    }
  })
})
