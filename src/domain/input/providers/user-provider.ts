/**
 * User Input Provider
 *
 * Handles manual user input for workflow steps.
 *
 * Features:
 * - Waits for user input via event bus
 * - Supports input timeout
 * - Handles abort signals
 * - Queues input when received before request
 */

import type { IInputProvider, InputRequest, InputResponse, InputAction } from './provider.interface'
import type { Unsubscribe } from '../../../shared/types'
import { InputTimeoutError, InputAbortedError } from '../../../shared/errors'
import type { IEventBus } from '../../../infrastructure/events/event-bus'

// ============================================================================
// Types
// ============================================================================

export interface UserProviderConfig {
  /** Event bus for receiving user input */
  eventBus: IEventBus
  /** Default timeout in milliseconds (0 = no timeout) */
  defaultTimeout?: number
  /** Input received callback */
  onInputReceived?: (input: string) => void
}

interface QueuedInput {
  input: string
  receivedAt: number
}

// ============================================================================
// User Input Provider Implementation
// ============================================================================

export class UserInputProvider implements IInputProvider {
  readonly type = 'user' as const

  private _isActive = false
  private readonly eventBus: IEventBus
  private readonly defaultTimeout: number
  private readonly onInputReceived?: (input: string) => void

  // Input queue for inputs received before request
  private inputQueue: QueuedInput[] = []

  // Pending request state
  private pendingResolve: ((response: InputResponse) => void) | null = null
  private pendingReject: ((error: Error) => void) | null = null
  private timeoutHandle: NodeJS.Timeout | null = null
  private unsubscribes: Unsubscribe[] = []

  constructor(config: UserProviderConfig) {
    this.eventBus = config.eventBus
    this.defaultTimeout = config.defaultTimeout ?? 0
    this.onInputReceived = config.onInputReceived
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

    // Subscribe to user input events
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

    // Clear any pending requests
    await this.abort()
  }

  async abort(): Promise<void> {
    // Clear timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }

    // Reject pending request
    if (this.pendingReject) {
      this.pendingReject(new InputAbortedError('User input aborted'))
      this.pendingResolve = null
      this.pendingReject = null
    }
  }

  async getInput(request: InputRequest, signal: AbortSignal): Promise<InputResponse> {
    if (!this._isActive) {
      throw new Error('User provider is not active')
    }

    // Check if aborted before starting
    if (signal.aborted) {
      throw new InputAbortedError('User input aborted')
    }

    // Check input queue first
    const queuedInput = this.inputQueue.shift()
    if (queuedInput) {
      return this.createResponse(queuedInput.input)
    }

    // Wait for user input
    return new Promise<InputResponse>((resolve, reject) => {
      this.pendingResolve = resolve
      this.pendingReject = reject

      // Set up abort handler
      const abortHandler = () => {
        this.clearPending()
        reject(new InputAbortedError('User input aborted'))
      }
      signal.addEventListener('abort', abortHandler, { once: true })

      // Set up timeout
      if (this.defaultTimeout > 0) {
        this.timeoutHandle = setTimeout(() => {
          this.clearPending()
          signal.removeEventListener('abort', abortHandler)
          reject(new InputTimeoutError(request.stepIndex, this.defaultTimeout))
        }, this.defaultTimeout)
      }
    })
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Submit user input (called from UI)
   */
  submitInput(input: string): void {
    // Notify callback
    if (this.onInputReceived) {
      this.onInputReceived(input)
    }

    // If we have a pending request, resolve it
    if (this.pendingResolve) {
      const resolve = this.pendingResolve
      this.clearPending()
      resolve(this.createResponse(input))
      return
    }

    // Otherwise queue it
    this.inputQueue.push({
      input,
      receivedAt: Date.now(),
    })
  }

  /**
   * Submit a special action (skip, stop, etc.)
   */
  submitAction(action: InputAction): void {
    if (!this.pendingResolve) {
      return
    }

    const resolve = this.pendingResolve
    this.clearPending()

    resolve({
      input: action.type === 'continue' ? action.input : '',
      source: 'user',
      action,
    })
  }

  /**
   * Clear the input queue
   */
  clearQueue(): void {
    this.inputQueue = []
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.inputQueue.length
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private subscribeToEvents(): void {
    // Listen for user input submissions
    this.unsubscribes.push(
      this.eventBus.subscribe('user:input-submitted', (event) => {
        this.submitInput(event.input)
      })
    )

    // Listen for user actions
    this.unsubscribes.push(
      this.eventBus.subscribe('user:action-submitted', (event) => {
        this.submitAction(event.action)
      })
    )
  }

  private clearPending(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
    this.pendingResolve = null
    this.pendingReject = null
  }

  private createResponse(input: string): InputResponse {
    // Parse input for special commands
    const action = this.parseInputAction(input)

    return {
      input,
      source: 'user',
      action,
    }
  }

  private parseInputAction(input: string): InputAction {
    const trimmed = input.trim().toLowerCase()

    // Check for special commands
    if (trimmed === '/skip' || trimmed === 's') {
      return { type: 'skip' }
    }

    if (trimmed === '/stop' || trimmed === 'q') {
      return { type: 'stop' }
    }

    if (trimmed === '/loop' || trimmed === 'l') {
      return { type: 'loop' }
    }

    if (trimmed === '/auto' || trimmed === 'a') {
      return { type: 'switch-mode', to: 'autopilot' }
    }

    // Default to continue
    return { type: 'continue', input }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export const createUserProvider = (config: UserProviderConfig): UserInputProvider => {
  return new UserInputProvider(config)
}
