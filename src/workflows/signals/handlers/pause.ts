/**
 * Pause Signal Handler
 *
 * Handles workflow:pause process events (user keypress Ctrl+P or 'p').
 * Logs, aborts current step, transitions state machine.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { SignalContext } from '../manager/types.js';

/**
 * Handle pause signal
 */
export function handlePauseSignal(ctx: SignalContext): void {
  debug('[PauseSignal] workflow:pause received, state=%s', ctx.machine.state);

  const stepContext = ctx.getStepContext();
  if (!stepContext) {
    debug('[PauseSignal] No step context, ignoring pause');
    return;
  }

  // Abort step if running
  if (ctx.machine.state === 'running') {
    ctx.machine.send({ type: 'PAUSE' });
    ctx.getAbortController()?.abort();
  }

  // Emit mode-change to switch to manual (ignored if already manual)
  (process as NodeJS.EventEmitter).emit('workflow:mode-change', { autonomousMode: false });

  debug('[PauseSignal] Pause handled');
}
