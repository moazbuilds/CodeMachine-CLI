/**
 * Skip Signal Handler
 *
 * Handles workflow:skip process events (Ctrl+S while agent running).
 * Updates status, transitions state machine to next step, and aborts.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { SignalContext } from '../manager/types.js';
import { StatusService } from '../../../agents/monitoring/index.js';

/**
 * Handle skip signal
 */
export async function handleSkipSignal(ctx: SignalContext): Promise<void> {
  debug('[SkipSignal] workflow:skip received, state=%s', ctx.machine.state);

  const stepContext = ctx.getStepContext();
  if (!stepContext) {
    debug('[SkipSignal] No step context, ignoring skip');
    return;
  }

  if (ctx.machine.state === 'running' || ctx.machine.state === 'awaiting' || ctx.machine.state === 'delegated') {
    const wasDelegated = ctx.machine.state === 'delegated';

    // Update UI status and mark as skipped (prevents cleanup from overwriting)
    const status = StatusService.getInstance();
    status.skipped(stepContext.agentId);

    // Mark by monitoring ID so handleAbort knows not to overwrite
    // Try machine context first, fall back to reverse lookup from uniqueAgentId
    const monitoringId = ctx.machine.context.currentMonitoringId ?? status.getMonitoringId(stepContext.agentId);
    if (monitoringId) {
      await status.markSkipped(monitoringId);
      debug('[SkipSignal] Marked monitoringId=%d as skipped', monitoringId);
    } else {
      debug('[SkipSignal] Warning: Could not find monitoringId for %s', stepContext.agentId);
    }

    // Clear queue and UI state to prevent leaking to next step
    ctx.indexManager.resetQueue();
    ctx.emitter.setInputState(null);

    // If in delegated state, abort the controller agent first
    if (wasDelegated) {
      debug('[SkipSignal] Aborting controller agent');
      ctx.mode.getControllerInput()?.abort?.();
    }

    // Transition state machine to next step
    ctx.machine.send({ type: 'SKIP' });

    // Abort the step execution
    ctx.getAbortController()?.abort();

    debug('[SkipSignal] Skip handled, advancing to next step');
  }
}
