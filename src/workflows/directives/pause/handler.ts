/**
 * Pause Directive Handler
 *
 * Implements the Directive interface for pause functionality.
 * The listener handles everything - log, state machine, abort.
 */

import { debug } from '../../../shared/logging/logger.js';
import type {
  Directive,
  DirectiveContext,
  DirectiveResult,
  DirectiveInitContext,
} from '../manager/types.js';
import { createPauseListener } from './listener.js';

/**
 * PauseDirective - handles workflow pause events
 *
 * When user presses 'p', the listener handles everything:
 * - Logs message to emitter
 * - Sends PAUSE to state machine
 * - Aborts current execution
 *
 * Runner just catches AbortError and returns.
 */
export class PauseDirective implements Directive {
  readonly name = 'pause' as const;
  private cleanupFn: (() => void) | null = null;

  /**
   * Initialize directive - setup event listener that handles everything
   */
  init(context: DirectiveInitContext): void {
    debug('[PauseDirective] Initializing');

    this.cleanupFn = createPauseListener({
      getAbortController: context.getAbortController,
      getStepContext: context.getStepContext,
      emitter: context.emitter,
      machine: context.machine,
    });
  }

  /**
   * Check if directive is active (not used in new architecture)
   */
  isActive(): boolean {
    return false; // Listener handles everything, no need to check
  }

  /**
   * Trigger pause (for programmatic pause via runner.pause())
   */
  trigger(): void {
    // Emit the event, listener will handle it
    process.emit('workflow:pause' as any);
  }

  /**
   * Reset directive state (called at step start)
   */
  reset(): void {
    // Nothing to reset - listener handles everything immediately
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    debug('[PauseDirective] Cleaning up');
    this.cleanupFn?.();
    this.cleanupFn = null;
  }

  /**
   * Handle pause directive (legacy - not called in new architecture)
   * Kept for interface compliance
   */
  async handle(_context: DirectiveContext): Promise<DirectiveResult> {
    // In new architecture, listener handles everything
    // This is only here for interface compliance
    return { handled: true, action: 'pause' };
  }
}
