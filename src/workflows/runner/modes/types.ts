/**
 * Mode Handler Types
 *
 * Defines the interface all mode handlers implement.
 * Works for both awaiting and delegated FSM states.
 */

import type { RunnerContext } from '../types.js';
import type { ResolvedScenario } from '../../step/scenarios/types.js';

/**
 * Result from mode handler execution
 */
export type ModeHandlerResult =
  | { type: 'continue' } // Stay in current state, re-evaluate
  | { type: 'advance' } // Move to next step
  | { type: 'loop'; targetIndex: number } // Rewind to step
  | { type: 'stop' } // Stop workflow
  | { type: 'pause'; reason?: string } // Pause workflow
  | { type: 'checkpoint' } // Checkpoint triggered
  | { type: 'error'; reason?: string } // Error occurred
  | { type: 'modeSwitch'; to: 'auto' | 'manual' }; // Switch mode

/**
 * Callbacks available to mode handlers
 */
export interface ModeHandlerCallbacks {
  /** Set auto mode on/off */
  setAutoMode: (enabled: boolean) => Promise<void>;
}

/**
 * Context passed to mode handlers
 */
export interface ModeHandlerContext {
  /** Full runner context */
  ctx: RunnerContext;

  /** Resolved scenario */
  scenario: ResolvedScenario;

  /** Callbacks for mode operations */
  callbacks: ModeHandlerCallbacks;

  /** Current FSM state */
  fsmState: 'awaiting' | 'delegated';
}

/**
 * Mode handler interface
 *
 * Each mode handler processes a specific behavior pattern:
 * - interactive: Wait for user/controller input
 * - autonomous: Auto-send prompts without waiting
 * - continuous: Auto-advance without prompts
 */
export interface ModeHandler {
  /** Handler identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Supported scenario IDs */
  readonly scenarios: readonly number[];

  /**
   * Handle the current state
   *
   * @param context Mode handler context
   * @returns Result indicating what action to take
   */
  handle(context: ModeHandlerContext): Promise<ModeHandlerResult>;
}
