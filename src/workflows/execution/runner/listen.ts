/**
 * Workflow Runner Event Listeners
 *
 * Handles skip and stop signals for the runner.
 * Mode signals are handled by signals/mode/listener.ts
 */

import { debug } from '../../../shared/logging/logger.js';
import type { RunnerContext } from './types.js';

/**
 * Setup workflow event listeners
 */
export function setupListeners(ctx: RunnerContext): void {
  // Skip listener (Ctrl+S while agent running)
  const skipHandler = () => {
    debug('[Runner] Skip requested');
    ctx.getAbortController()?.abort();
  };
  process.on('workflow:skip', skipHandler);

  // Stop listener
  const stopHandler = () => {
    debug('[Runner] Stop requested');
    ctx.getAbortController()?.abort();
    ctx.machine.send({ type: 'STOP' });
  };
  process.on('workflow:stop', stopHandler);

  // Clean up on machine final state
  ctx.machine.subscribe(() => {
    if (ctx.machine.isFinal) {
      process.removeListener('workflow:skip', skipHandler);
      process.removeListener('workflow:stop', stopHandler);
      ctx.behaviorManager.cleanup();
    }
  });
}
