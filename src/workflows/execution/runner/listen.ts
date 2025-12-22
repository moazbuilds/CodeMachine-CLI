/**
 * Workflow Runner Event Listeners
 */

import { debug } from '../../../shared/logging/logger.js';
import type { RunnerContext } from './types.js';

export interface ListenerCallbacks {
  setAutoMode: (enabled: boolean) => Promise<void>;
}

/**
 * Setup workflow event listeners
 */
export function setupListeners(ctx: RunnerContext, callbacks: ListenerCallbacks): void {
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

  // Mode change listener
  const modeChangeHandler = async (data: { autonomousMode: boolean }) => {
    debug('[Runner] Mode change: autoMode=%s', data.autonomousMode);
    // If in waiting state, let the provider's listener handle it
    // The provider will return __SWITCH_TO_AUTO__ or __SWITCH_TO_MANUAL__
    // and handleWaiting() will call setAutoMode()
    if (ctx.machine.state === 'awaiting') {
      debug('[Runner] In awaiting state, provider will handle mode switch');
      return;
    }
    // In other states (running, idle), set auto mode directly
    await callbacks.setAutoMode(data.autonomousMode);
  };
  process.on('workflow:mode-change', modeChangeHandler);

  // Clean up on machine final state
  ctx.machine.subscribe(() => {
    if (ctx.machine.isFinal) {
      process.removeListener('workflow:skip', skipHandler);
      process.removeListener('workflow:stop', stopHandler);
      process.removeListener('workflow:mode-change', modeChangeHandler);
      ctx.behaviorManager.cleanup();
    }
  });
}
