/**
 * Autopilot Input Provider
 *
 * Automatically provides input for workflow steps based on previous output.
 *
 * Features:
 * - Automatic continuation using previous output
 * - Configurable delay between steps
 * - Chained prompt handling
 * - Safety limits (max auto-steps, error detection)
 */

import type { IInputProvider, InputRequest, InputResponse, InputAction } from './provider.interface'
import type { Unsubscribe, ChainedPrompt } from '../../../shared/types'
import { InputAbortedError } from '../../../shared/errors'
import type { IEventBus } from '../../../infrastructure/events/event-bus'

// ============================================================================
// Types
// ============================================================================

export interface AutopilotProviderConfig {
  /** Event bus for emitting events */
  eventBus: IEventBus
  /** Delay between automatic inputs (ms) */
  stepDelay?: number
  /** Maximum consecutive auto steps (safety limit) */
  maxConsecutiveSteps?: number
  /** Whether to stop on error patterns in output */
  stopOnError?: boolean
  /** Custom error patterns to detect */
  errorPatterns?: RegExp[]
  /** Callback when autopilot provides input */
  onAutoInput?: (input: string, stepIndex: number) => void
}

interface AutopilotState {
  consecutiveSteps: number
  lastInputTime: number
  stepsCompleted: number
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_STEP_DELAY = 100 // 100ms
const DEFAULT_MAX_CONSECUTIVE_STEPS = 100
const DEFAULT_ERROR_PATTERNS = [
  /error:/i,
  /exception:/i,
  /failed:/i,
  /fatal:/i,
  /panic:/i,
]

// ============================================================================
// Autopilot Input Provider Implementation
// ============================================================================

export class AutopilotInputProvider implements IInputProvider {
  readonly type = 'autopilot' as const

  private _isActive = false
  private readonly eventBus: IEventBus
  private readonly stepDelay: number
  private readonly maxConsecutiveSteps: number
  private readonly stopOnError: boolean
  private readonly errorPatterns: RegExp[]
  private readonly onAutoInput?: (input: string, stepIndex: number) => void

  // Internal state
  private state: AutopilotState = {
    consecutiveSteps: 0,
    lastInputTime: 0,
    stepsCompleted: 0,
  }

  // Abort handling
  private abortController: AbortController | null = null
  private unsubscribes: Unsubscribe[] = []

  constructor(config: AutopilotProviderConfig) {
    this.eventBus = config.eventBus
    this.stepDelay = config.stepDelay ?? DEFAULT_STEP_DELAY
    this.maxConsecutiveSteps = config.maxConsecutiveSteps ?? DEFAULT_MAX_CONSECUTIVE_STEPS
    this.stopOnError = config.stopOnError ?? false
    this.errorPatterns = config.errorPatterns ?? DEFAULT_ERROR_PATTERNS
    this.onAutoInput = config.onAutoInput
  }

  // ============================================================================
  // IInputProvider Implementation
  // ============================================================================

  get isActive(): boolean {
    return this._isActive
  }

  async activate(): Promise<void> {
    if (this._isActive) {
      return
    }

    this._isActive = true
    this.state = {
      consecutiveSteps: 0,
      lastInputTime: 0,
      stepsCompleted: 0,
    }

    // Subscribe to events
    this.subscribeToEvents()
  }

  async deactivate(): Promise<void> {
    if (!this._isActive) {
      return
    }

    this._isActive = false

    // Clean up subscriptions
    for (const unsub of this.unsubscribes) {
      unsub()
    }
    this.unsubscribes = []

    // Abort any pending operations
    await this.abort()
  }

  async abort(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  async getInput(request: InputRequest, signal: AbortSignal): Promise<InputResponse> {
    if (!this._isActive) {
      throw new Error('Autopilot provider is not active')
    }

    // Check if aborted before starting
    if (signal.aborted) {
      throw new InputAbortedError('Autopilot input aborted')
    }

    // Create internal abort controller
    this.abortController = new AbortController()

    // Link to external signal
    const abortHandler = () => {
      this.abortController?.abort()
    }
    signal.addEventListener('abort', abortHandler, { once: true })

    try {
      // Check safety limits
      const safetyCheck = this.checkSafetyLimits(request)
      if (safetyCheck) {
        return safetyCheck
      }

      // Apply step delay
      await this.applyStepDelay(this.abortController.signal)

      // Check for errors in previous output
      if (this.stopOnError && request.previousOutput) {
        const errorCheck = this.checkForErrors(request.previousOutput)
        if (errorCheck) {
          return errorCheck
        }
      }

      // Determine the input to provide
      const input = this.determineInput(request)

      // Update state
      this.state.consecutiveSteps++
      this.state.lastInputTime = Date.now()
      this.state.stepsCompleted++

      // Notify callback
      if (this.onAutoInput) {
        this.onAutoInput(input, request.stepIndex)
      }

      // Emit event
      this.eventBus.emit({
        type: 'autopilot:input-provided',
        timestamp: Date.now(),
        stepIndex: request.stepIndex,
        input,
        consecutiveSteps: this.state.consecutiveSteps,
      })

      return {
        input,
        source: 'autopilot',
        action: { type: 'continue', input },
      }
    } finally {
      signal.removeEventListener('abort', abortHandler)
      this.abortController = null
    }
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Reset consecutive step counter
   */
  resetConsecutiveSteps(): void {
    this.state.consecutiveSteps = 0
  }

  /**
   * Get current state
   */
  getState(): Readonly<AutopilotState> {
    return { ...this.state }
  }

  /**
   * Force stop autopilot (returns to manual mode)
   */
  forceStop(): InputResponse {
    return {
      input: '',
      source: 'autopilot',
      action: { type: 'switch-mode', to: 'user' },
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private subscribeToEvents(): void {
    // Listen for manual override
    this.unsubscribes.push(
      this.eventBus.subscribe('user:manual-override', () => {
        this.abort()
      })
    )

    // Listen for step completion to reset counter if needed
    this.unsubscribes.push(
      this.eventBus.subscribe('step:completed', () => {
        // Keep tracking but don't reset here
      })
    )
  }

  private checkSafetyLimits(request: InputRequest): InputResponse | null {
    // Check max consecutive steps
    if (this.state.consecutiveSteps >= this.maxConsecutiveSteps) {
      return {
        input: '',
        source: 'autopilot',
        action: {
          type: 'switch-mode',
          to: 'user',
        },
      }
    }

    return null
  }

  private async applyStepDelay(signal: AbortSignal): Promise<void> {
    if (this.stepDelay <= 0) {
      return
    }

    const timeSinceLastInput = Date.now() - this.state.lastInputTime
    const remainingDelay = Math.max(0, this.stepDelay - timeSinceLastInput)

    if (remainingDelay > 0) {
      await this.sleep(remainingDelay, signal)
    }
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms)

      signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new InputAbortedError('Autopilot input aborted'))
      }, { once: true })
    })
  }

  private checkForErrors(output: string): InputResponse | null {
    for (const pattern of this.errorPatterns) {
      if (pattern.test(output)) {
        // Switch to manual mode when error detected
        this.eventBus.emit({
          type: 'autopilot:error-detected',
          timestamp: Date.now(),
          pattern: pattern.toString(),
          output: output.substring(0, 200), // Truncate for event
        })

        return {
          input: '',
          source: 'autopilot',
          action: {
            type: 'switch-mode',
            to: 'user',
          },
        }
      }
    }

    return null
  }

  private determineInput(request: InputRequest): string {
    // Priority 1: Check for chained prompts
    if (request.chainedPrompts && request.chainedPrompts.length > 0) {
      return this.getChainedInput(request.chainedPrompts)
    }

    // Priority 2: Use previous output as input
    if (request.previousOutput) {
      return this.extractInputFromOutput(request.previousOutput)
    }

    // Priority 3: Use prompt as input
    if (request.prompt) {
      return request.prompt
    }

    // Default: Empty continue (let agent proceed)
    return ''
  }

  private getChainedInput(chainedPrompts: ChainedPrompt[]): string {
    // Find the first uncompleted chained prompt
    for (const prompt of chainedPrompts) {
      if (!prompt.completed) {
        return prompt.content
      }
    }

    // All completed, return empty
    return ''
  }

  private extractInputFromOutput(output: string): string {
    // Try to find a natural continuation point in the output
    // This is a simple implementation - can be made smarter

    // Look for common patterns that indicate next action
    const continuePatterns = [
      /continue with[:\s]*(.*)/i,
      /next step[:\s]*(.*)/i,
      /proceed with[:\s]*(.*)/i,
      /ready to[:\s]*(.*)/i,
    ]

    for (const pattern of continuePatterns) {
      const match = output.match(pattern)
      if (match?.[1]) {
        return match[1].trim()
      }
    }

    // Default: use the last non-empty line
    const lines = output.trim().split('\n').filter(l => l.trim())
    if (lines.length > 0) {
      return lines[lines.length - 1].trim()
    }

    return ''
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export const createAutopilotProvider = (config: AutopilotProviderConfig): AutopilotInputProvider => {
  return new AutopilotInputProvider(config)
}
