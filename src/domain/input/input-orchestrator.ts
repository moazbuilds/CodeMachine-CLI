/**
 * Input Orchestrator
 *
 * Manages input providers and handles mode switching without race conditions.
 * Ensures clean transitions between user and autopilot modes.
 */

import type { InputMode, Unsubscribe } from '../../shared/types'
import { InputAbortedError, InputProviderError } from '../../shared/errors'
import type { IInputProvider, InputRequest, InputResponse, ProviderEvent } from './providers/provider.interface'

// ============================================================================
// Types
// ============================================================================

export interface InputOrchestratorConfig {
  /** Initial input mode */
  initialMode: InputMode
  /** User input provider factory */
  createUserProvider: () => IInputProvider
  /** Autopilot input provider factory */
  createAutopilotProvider: () => IInputProvider
}

export type OrchestratorState =
  | { status: 'idle' }
  | { status: 'active'; mode: InputMode }
  | { status: 'switching'; from: InputMode; to: InputMode }
  | { status: 'aborted' }

// ============================================================================
// Input Orchestrator
// ============================================================================

export class InputOrchestrator {
  private state: OrchestratorState = { status: 'idle' }
  private activeProvider: IInputProvider | null = null
  private pendingSwitch: Promise<void> | null = null
  private abortController: AbortController | null = null
  private listeners = new Set<(event: ProviderEvent) => void>()

  private readonly userProvider: IInputProvider
  private readonly autopilotProvider: IInputProvider

  constructor(config: InputOrchestratorConfig) {
    this.userProvider = config.createUserProvider()
    this.autopilotProvider = config.createAutopilotProvider()

    // Set initial mode
    this.activeProvider =
      config.initialMode === 'autopilot' ? this.autopilotProvider : this.userProvider
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get the current input mode
   */
  getMode(): InputMode {
    if (this.state.status === 'active') {
      return this.state.mode
    }
    return this.activeProvider?.type ?? 'user'
  }

  /**
   * Get the current state
   */
  getState(): OrchestratorState {
    return this.state
  }

  /**
   * Check if currently switching modes
   */
  isSwitching(): boolean {
    return this.state.status === 'switching'
  }

  /**
   * Switch to a different input mode
   * Waits for any pending switch to complete first
   */
  async switchMode(mode: InputMode): Promise<void> {
    // Same mode, no-op
    if (this.getMode() === mode) {
      return
    }

    // Wait for any pending switch
    if (this.pendingSwitch) {
      await this.pendingSwitch
    }

    // If aborted, don't allow switching
    if (this.state.status === 'aborted') {
      throw new InputAbortedError('Orchestrator has been aborted')
    }

    const previousMode = this.getMode()
    this.state = { status: 'switching', from: previousMode, to: mode }

    this.pendingSwitch = this.performSwitch(mode)

    try {
      await this.pendingSwitch
    } finally {
      this.pendingSwitch = null
    }
  }

  /**
   * Get input from the active provider
   */
  async getInput(request: InputRequest): Promise<InputResponse> {
    // Wait for any pending switch
    if (this.pendingSwitch) {
      await this.pendingSwitch
    }

    if (!this.activeProvider) {
      throw new InputProviderError(this.getMode(), 'No active provider')
    }

    if (this.state.status === 'aborted') {
      throw new InputAbortedError('Orchestrator has been aborted')
    }

    // Create abort controller for this request
    this.abortController = new AbortController()

    try {
      this.state = { status: 'active', mode: this.getMode() }

      const response = await this.activeProvider.getInput(
        request,
        this.abortController.signal
      )

      this.emit({ type: 'input-received', response })

      // Handle mode switch action
      if (response.action.type === 'switch-mode') {
        await this.switchMode(response.action.to)
        // Recursively get input from new provider
        return this.getInput(request)
      }

      return response
    } catch (error) {
      if (this.abortController.signal.aborted) {
        throw new InputAbortedError('Input request was aborted')
      }
      this.emit({ type: 'input-error', error: error as Error })
      throw error
    } finally {
      this.abortController = null
    }
  }

  /**
   * Abort any pending input request
   */
  async abort(): Promise<void> {
    this.state = { status: 'aborted' }

    // Abort current request
    if (this.abortController) {
      this.abortController.abort()
    }

    // Abort active provider
    if (this.activeProvider) {
      await this.activeProvider.abort()
    }
  }

  /**
   * Reset the orchestrator to idle state
   */
  async reset(mode: InputMode = 'user'): Promise<void> {
    await this.abort()
    this.state = { status: 'idle' }
    this.activeProvider = mode === 'autopilot' ? this.autopilotProvider : this.userProvider
  }

  /**
   * Subscribe to orchestrator events
   */
  subscribe(listener: (event: ProviderEvent) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async performSwitch(mode: InputMode): Promise<void> {
    const newProvider = mode === 'autopilot' ? this.autopilotProvider : this.userProvider
    const previousMode = this.getMode()

    // Abort any pending request
    if (this.abortController) {
      this.abortController.abort()
    }

    // Deactivate current provider
    if (this.activeProvider) {
      await this.activeProvider.deactivate()
      this.emit({ type: 'deactivated', provider: previousMode })
    }

    // Activate new provider
    await newProvider.activate()
    this.activeProvider = newProvider
    this.emit({ type: 'activated', provider: mode })

    this.state = { status: 'active', mode }
  }

  private emit(event: ProviderEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[InputOrchestrator] Listener error:', error)
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export const createInputOrchestrator = (
  config: InputOrchestratorConfig
): InputOrchestrator => {
  return new InputOrchestrator(config)
}
