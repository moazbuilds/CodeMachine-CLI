/**
 * Skip Signal Handler
 *
 * Handles workflow:skip process events (Ctrl+S while agent running).
 * Aborts current step execution.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { SignalContext } from '../manager/types.js';

/**
 * Handle skip signal
 */
export function handleSkipSignal(ctx: SignalContext): void {
  debug('[SkipSignal] Skip requested');
  ctx.getAbortController()?.abort();
}
