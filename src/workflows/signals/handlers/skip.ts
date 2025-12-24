/**
 * Skip Signal Handler
 *
 * Handles workflow:skip process events (Ctrl+S while agent running).
 * Updates status, transitions state machine to next step, and aborts.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { SignalContext } from '../manager/types.js';

/**
 * Handle skip signal
 */
export function handleSkipSignal(ctx: SignalContext): void {
  debug('[SkipSignal] workflow:skip received, state=%s', ctx.machine.state);

  const stepContext = ctx.getStepContext();
  if (!stepContext) {
    debug('[SkipSignal] No step context, ignoring skip');
    return;
  }

  if (ctx.machine.state === 'running') {
    // Update UI status
    ctx.emitter.updateAgentStatus(stepContext.agentId, 'skipped');

    // Transition state machine to next step
    ctx.machine.send({ type: 'SKIP' });

    // Abort the step execution
    ctx.getAbortController()?.abort();

    debug('[SkipSignal] Skip handled, advancing to next step');
  }
}
