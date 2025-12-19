/**
 * Input Provider Interface
 *
 * Defines the contract for input providers (user and autopilot).
 */

import type { ChainedPrompt } from '../../../shared/types'

// ============================================================================
// Input Types
// ============================================================================

export interface InputRequest {
  readonly stepIndex: number
  readonly prompt?: string
  readonly chainedPrompts?: ChainedPrompt[]
  readonly previousOutput?: string
}

export interface InputResponse {
  readonly input: string
  readonly source: 'user' | 'autopilot' | 'queue'
  readonly action: InputAction
}

export type InputAction =
  | { type: 'continue'; input: string }
  | { type: 'skip'; reason?: string }
  | { type: 'loop' }
  | { type: 'stop'; reason?: string }
  | { type: 'switch-mode'; to: 'user' | 'autopilot' }

// ============================================================================
// Provider Interface
// ============================================================================

export interface IInputProvider {
  /** Provider type identifier */
  readonly type: 'user' | 'autopilot'

  /** Whether the provider is currently active */
  readonly isActive: boolean

  /**
   * Get input from this provider
   * @param request - The input request context
   * @param signal - AbortSignal for cancellation
   * @returns The input response
   */
  getInput(request: InputRequest, signal: AbortSignal): Promise<InputResponse>

  /**
   * Activate this provider
   * Called when switching to this provider
   */
  activate(): Promise<void>

  /**
   * Deactivate this provider
   * Called when switching away from this provider
   */
  deactivate(): Promise<void>

  /**
   * Abort any pending input request
   */
  abort(): Promise<void>
}

// ============================================================================
// Provider Events
// ============================================================================

export type ProviderEvent =
  | { type: 'activated'; provider: 'user' | 'autopilot' }
  | { type: 'deactivated'; provider: 'user' | 'autopilot' }
  | { type: 'input-received'; response: InputResponse }
  | { type: 'input-timeout'; stepIndex: number }
  | { type: 'input-error'; error: Error }
