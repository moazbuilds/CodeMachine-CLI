import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

import {
  UserInputProvider,
  createUserProvider,
} from '../../../src/domain/input/providers/user-provider'
import {
  AutopilotInputProvider,
  createAutopilotProvider,
} from '../../../src/domain/input/providers/autopilot-provider'
import { createEventBus, type IEventBus } from '../../../src/infrastructure/events/event-bus'
import type { InputRequest } from '../../../src/domain/input/providers/provider.interface'

// ============================================================================
// Test Helpers
// ============================================================================

const createTestRequest = (overrides: Partial<InputRequest> = {}): InputRequest => ({
  stepIndex: 0,
  prompt: 'Enter your input',
  ...overrides,
})

// ============================================================================
// User Input Provider Tests
// ============================================================================

describe('UserInputProvider', () => {
  let eventBus: IEventBus
  let provider: UserInputProvider

  beforeEach(() => {
    eventBus = createEventBus()
    provider = createUserProvider({ eventBus })
  })

  afterEach(async () => {
    if (provider.isActive) {
      await provider.deactivate()
    }
  })

  describe('Lifecycle', () => {
    it('starts inactive', () => {
      expect(provider.isActive).toBe(false)
    })

    it('activates correctly', async () => {
      await provider.activate()
      expect(provider.isActive).toBe(true)
    })

    it('deactivates correctly', async () => {
      await provider.activate()
      await provider.deactivate()
      expect(provider.isActive).toBe(false)
    })

    it('can be activated multiple times safely', async () => {
      await provider.activate()
      await provider.activate()
      expect(provider.isActive).toBe(true)
    })

    it('can be deactivated multiple times safely', async () => {
      await provider.activate()
      await provider.deactivate()
      await provider.deactivate()
      expect(provider.isActive).toBe(false)
    })

    it('has correct type', () => {
      expect(provider.type).toBe('user')
    })
  })

  describe('Input Handling', () => {
    it('throws when getting input while inactive', async () => {
      const abortController = new AbortController()
      const request = createTestRequest()

      await expect(
        provider.getInput(request, abortController.signal)
      ).rejects.toThrow('User provider is not active')
    })

    it('resolves when input is submitted', async () => {
      await provider.activate()

      const abortController = new AbortController()
      const request = createTestRequest()

      // Start waiting for input
      const inputPromise = provider.getInput(request, abortController.signal)

      // Submit input
      provider.submitInput('test input')

      const response = await inputPromise
      expect(response.input).toBe('test input')
      expect(response.source).toBe('user')
    })

    it('returns queued input immediately', async () => {
      await provider.activate()

      // Queue input before request
      provider.submitInput('queued input')

      const abortController = new AbortController()
      const request = createTestRequest()

      const response = await provider.getInput(request, abortController.signal)
      expect(response.input).toBe('queued input')
    })

    it('queues multiple inputs', async () => {
      await provider.activate()

      provider.submitInput('input 1')
      provider.submitInput('input 2')
      provider.submitInput('input 3')

      expect(provider.getQueueSize()).toBe(3)

      const abortController = new AbortController()

      const response1 = await provider.getInput(createTestRequest(), abortController.signal)
      expect(response1.input).toBe('input 1')

      const response2 = await provider.getInput(createTestRequest(), abortController.signal)
      expect(response2.input).toBe('input 2')
    })

    it('clears queue', async () => {
      await provider.activate()

      provider.submitInput('input 1')
      provider.submitInput('input 2')
      provider.clearQueue()

      expect(provider.getQueueSize()).toBe(0)
    })
  })

  describe('Special Commands', () => {
    beforeEach(async () => {
      await provider.activate()
    })

    it('parses /skip command', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      provider.submitInput('/skip')

      const response = await inputPromise
      expect(response.action.type).toBe('skip')
    })

    it('parses s shortcut for skip', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      provider.submitInput('s')

      const response = await inputPromise
      expect(response.action.type).toBe('skip')
    })

    it('parses /stop command', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      provider.submitInput('/stop')

      const response = await inputPromise
      expect(response.action.type).toBe('stop')
    })

    it('parses q shortcut for stop', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      provider.submitInput('q')

      const response = await inputPromise
      expect(response.action.type).toBe('stop')
    })

    it('parses /loop command', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      provider.submitInput('/loop')

      const response = await inputPromise
      expect(response.action.type).toBe('loop')
    })

    it('parses /auto command for mode switch', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      provider.submitInput('/auto')

      const response = await inputPromise
      expect(response.action.type).toBe('switch-mode')
      if (response.action.type === 'switch-mode') {
        expect(response.action.to).toBe('autopilot')
      }
    })

    it('treats regular input as continue', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      provider.submitInput('regular input text')

      const response = await inputPromise
      expect(response.action.type).toBe('continue')
      if (response.action.type === 'continue') {
        expect(response.action.input).toBe('regular input text')
      }
    })
  })

  describe('Action Submission', () => {
    beforeEach(async () => {
      await provider.activate()
    })

    it('submits skip action', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      provider.submitAction({ type: 'skip' })

      const response = await inputPromise
      expect(response.action.type).toBe('skip')
    })

    it('submits stop action', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      provider.submitAction({ type: 'stop', reason: 'user cancelled' })

      const response = await inputPromise
      expect(response.action.type).toBe('stop')
    })

    it('ignores action when no pending request', () => {
      // Should not throw
      provider.submitAction({ type: 'skip' })
    })
  })

  describe('Abort Handling', () => {
    beforeEach(async () => {
      await provider.activate()
    })

    it('rejects when signal is already aborted', async () => {
      const abortController = new AbortController()
      abortController.abort()

      await expect(
        provider.getInput(createTestRequest(), abortController.signal)
      ).rejects.toThrow('User input aborted')
    })

    it('rejects when signal is aborted during wait', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      // Abort after a small delay
      setTimeout(() => abortController.abort(), 10)

      await expect(inputPromise).rejects.toThrow('User input aborted')
    })

    it('abort() rejects pending request', async () => {
      const abortController = new AbortController()
      const inputPromise = provider.getInput(createTestRequest(), abortController.signal)

      setTimeout(() => provider.abort(), 10)

      await expect(inputPromise).rejects.toThrow('User input aborted')
    })
  })

  describe('Timeout', () => {
    it('rejects after timeout', async () => {
      const providerWithTimeout = createUserProvider({
        eventBus,
        defaultTimeout: 50,
      })

      await providerWithTimeout.activate()

      const abortController = new AbortController()
      const inputPromise = providerWithTimeout.getInput(
        createTestRequest(),
        abortController.signal
      )

      await expect(inputPromise).rejects.toThrow()

      await providerWithTimeout.deactivate()
    })
  })
})

// ============================================================================
// Autopilot Input Provider Tests
// ============================================================================

describe('AutopilotInputProvider', () => {
  let eventBus: IEventBus
  let provider: AutopilotInputProvider

  beforeEach(() => {
    eventBus = createEventBus()
    provider = createAutopilotProvider({
      eventBus,
      stepDelay: 0, // No delay for tests
    })
  })

  afterEach(async () => {
    if (provider.isActive) {
      await provider.deactivate()
    }
  })

  describe('Lifecycle', () => {
    it('starts inactive', () => {
      expect(provider.isActive).toBe(false)
    })

    it('activates correctly', async () => {
      await provider.activate()
      expect(provider.isActive).toBe(true)
    })

    it('deactivates correctly', async () => {
      await provider.activate()
      await provider.deactivate()
      expect(provider.isActive).toBe(false)
    })

    it('has correct type', () => {
      expect(provider.type).toBe('autopilot')
    })

    it('resets state on activation', async () => {
      await provider.activate()
      const abortController = new AbortController()

      // Make some calls
      await provider.getInput(createTestRequest(), abortController.signal)
      await provider.getInput(createTestRequest(), abortController.signal)

      // Deactivate and reactivate
      await provider.deactivate()
      await provider.activate()

      const state = provider.getState()
      expect(state.consecutiveSteps).toBe(0)
    })
  })

  describe('Automatic Input', () => {
    beforeEach(async () => {
      await provider.activate()
    })

    it('provides automatic input', async () => {
      const abortController = new AbortController()
      const request = createTestRequest({ previousOutput: 'Previous step output' })

      const response = await provider.getInput(request, abortController.signal)

      expect(response.source).toBe('autopilot')
      expect(response.action.type).toBe('continue')
    })

    it('uses previous output as input', async () => {
      const abortController = new AbortController()
      const request = createTestRequest({
        previousOutput: 'continue with next task',
      })

      const response = await provider.getInput(request, abortController.signal)

      expect(response.input).toBeTruthy()
    })

    it('uses prompt when no previous output', async () => {
      const abortController = new AbortController()
      const request = createTestRequest({
        prompt: 'Do the task',
        previousOutput: undefined,
      })

      const response = await provider.getInput(request, abortController.signal)

      expect(response.input).toBe('Do the task')
    })

    it('increments consecutive steps counter', async () => {
      const abortController = new AbortController()

      await provider.getInput(createTestRequest(), abortController.signal)
      await provider.getInput(createTestRequest(), abortController.signal)
      await provider.getInput(createTestRequest(), abortController.signal)

      const state = provider.getState()
      expect(state.consecutiveSteps).toBe(3)
    })
  })

  describe('Chained Prompts', () => {
    beforeEach(async () => {
      await provider.activate()
    })

    it('uses first uncompleted chained prompt', async () => {
      const abortController = new AbortController()
      const request = createTestRequest({
        chainedPrompts: [
          { content: 'First prompt', completed: true },
          { content: 'Second prompt', completed: false },
          { content: 'Third prompt', completed: false },
        ],
      })

      const response = await provider.getInput(request, abortController.signal)

      expect(response.input).toBe('Second prompt')
    })

    it('returns empty when all chains completed', async () => {
      const abortController = new AbortController()
      const request = createTestRequest({
        chainedPrompts: [
          { content: 'First prompt', completed: true },
          { content: 'Second prompt', completed: true },
        ],
      })

      const response = await provider.getInput(request, abortController.signal)

      expect(response.input).toBe('')
    })
  })

  describe('Safety Limits', () => {
    it('switches to manual after max consecutive steps', async () => {
      const limitedProvider = createAutopilotProvider({
        eventBus,
        stepDelay: 0,
        maxConsecutiveSteps: 3,
      })

      await limitedProvider.activate()

      const abortController = new AbortController()

      // Make 3 calls
      await limitedProvider.getInput(createTestRequest(), abortController.signal)
      await limitedProvider.getInput(createTestRequest(), abortController.signal)
      await limitedProvider.getInput(createTestRequest(), abortController.signal)

      // 4th call should trigger mode switch
      const response = await limitedProvider.getInput(
        createTestRequest(),
        abortController.signal
      )

      expect(response.action.type).toBe('switch-mode')
      if (response.action.type === 'switch-mode') {
        expect(response.action.to).toBe('user')
      }

      await limitedProvider.deactivate()
    })

    it('resets consecutive steps counter', async () => {
      await provider.activate()

      const abortController = new AbortController()
      await provider.getInput(createTestRequest(), abortController.signal)
      await provider.getInput(createTestRequest(), abortController.signal)

      provider.resetConsecutiveSteps()

      const state = provider.getState()
      expect(state.consecutiveSteps).toBe(0)
    })
  })

  describe('Error Detection', () => {
    it('switches to manual when error detected in output', async () => {
      const errorDetectingProvider = createAutopilotProvider({
        eventBus,
        stepDelay: 0,
        stopOnError: true,
      })

      await errorDetectingProvider.activate()

      const abortController = new AbortController()
      const request = createTestRequest({
        previousOutput: 'Error: Something went wrong',
      })

      const response = await errorDetectingProvider.getInput(
        request,
        abortController.signal
      )

      expect(response.action.type).toBe('switch-mode')
      if (response.action.type === 'switch-mode') {
        expect(response.action.to).toBe('user')
      }

      await errorDetectingProvider.deactivate()
    })

    it('detects various error patterns', async () => {
      const errorDetectingProvider = createAutopilotProvider({
        eventBus,
        stepDelay: 0,
        stopOnError: true,
      })

      await errorDetectingProvider.activate()
      const abortController = new AbortController()

      const errorOutputs = [
        'Error: Connection failed',
        'Exception: Null pointer',
        'Failed: Build failed',
        'FATAL: System crash',
        'panic: runtime error',
      ]

      for (const output of errorOutputs) {
        // Reset consecutive steps to avoid safety limit
        errorDetectingProvider.resetConsecutiveSteps()

        const request = createTestRequest({ previousOutput: output })
        const response = await errorDetectingProvider.getInput(
          request,
          abortController.signal
        )

        expect(response.action.type).toBe('switch-mode')
      }

      await errorDetectingProvider.deactivate()
    })

    it('supports custom error patterns', async () => {
      const customProvider = createAutopilotProvider({
        eventBus,
        stepDelay: 0,
        stopOnError: true,
        errorPatterns: [/CUSTOM_ERROR/],
      })

      await customProvider.activate()

      const abortController = new AbortController()
      const request = createTestRequest({
        previousOutput: 'CUSTOM_ERROR: Something bad happened',
      })

      const response = await customProvider.getInput(request, abortController.signal)

      expect(response.action.type).toBe('switch-mode')

      await customProvider.deactivate()
    })
  })

  describe('Step Delay', () => {
    it('applies step delay between inputs', async () => {
      const delayedProvider = createAutopilotProvider({
        eventBus,
        stepDelay: 50,
      })

      await delayedProvider.activate()

      const abortController = new AbortController()

      const startTime = Date.now()
      await delayedProvider.getInput(createTestRequest(), abortController.signal)
      await delayedProvider.getInput(createTestRequest(), abortController.signal)
      const endTime = Date.now()

      // Second call should have been delayed
      expect(endTime - startTime).toBeGreaterThanOrEqual(40) // Allow some margin

      await delayedProvider.deactivate()
    })
  })

  describe('Abort Handling', () => {
    beforeEach(async () => {
      await provider.activate()
    })

    it('throws when getting input while inactive', async () => {
      await provider.deactivate()

      const abortController = new AbortController()
      await expect(
        provider.getInput(createTestRequest(), abortController.signal)
      ).rejects.toThrow('Autopilot provider is not active')
    })

    it('rejects when signal is already aborted', async () => {
      const abortController = new AbortController()
      abortController.abort()

      await expect(
        provider.getInput(createTestRequest(), abortController.signal)
      ).rejects.toThrow('Autopilot input aborted')
    })

    it('abort() cancels pending operation', async () => {
      const delayedProvider = createAutopilotProvider({
        eventBus,
        stepDelay: 1000,
      })

      await delayedProvider.activate()

      const abortController = new AbortController()
      const inputPromise = delayedProvider.getInput(
        createTestRequest(),
        abortController.signal
      )

      setTimeout(() => delayedProvider.abort(), 10)

      await expect(inputPromise).rejects.toThrow('Autopilot input aborted')

      await delayedProvider.deactivate()
    })
  })

  describe('Force Stop', () => {
    it('returns mode switch to user', () => {
      const response = provider.forceStop()

      expect(response.source).toBe('autopilot')
      expect(response.action.type).toBe('switch-mode')
      if (response.action.type === 'switch-mode') {
        expect(response.action.to).toBe('user')
      }
    })
  })
})
