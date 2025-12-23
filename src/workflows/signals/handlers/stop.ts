/**
 * Stop Signal Handler
 *
 * Handles workflow:stop process events.
 * Aborts current step and transitions state machine to stopped.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { SignalContext } from '../manager/types.js';

/**
 * Handle stop signal
 */
export function handleStopSignal(ctx: SignalContext): void {
  debug('[StopSignal] Stop requested');
  ctx.getAbortController()?.abort();
  ctx.machine.send({ type: 'STOP' });
}
