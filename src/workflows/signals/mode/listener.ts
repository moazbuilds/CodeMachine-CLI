/**
 * Mode Signal Listener
 *
 * Listens for workflow:mode-change events and triggers mode switching.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { StateMachine } from '../../state/index.js';
import { setAutoMode } from './switcher.js';
import type { ModeSwitchContext } from './types.js';

export interface ModeListenerOptions {
  ctx: ModeSwitchContext;
  machine: StateMachine;
}

/**
 * Create mode change event listener
 * Returns cleanup function to remove the listener
 */
export function createModeListener(options: ModeListenerOptions): () => void {
  const { ctx, machine } = options;

  const handler = async (data: { autonomousMode: boolean }) => {
    debug('[ModeListener] workflow:mode-change event received, autoMode=%s', data.autonomousMode);

    // If in waiting state, let the provider's listener handle it
    // The provider will return __SWITCH_TO_AUTO__ or __SWITCH_TO_MANUAL__
    // and handleWaiting() will call setAutoMode()
    if (machine.state === 'awaiting') {
      debug('[ModeListener] In awaiting state, provider will handle mode switch');
      return;
    }

    // In other states (running, idle), set auto mode directly
    await setAutoMode(ctx, data.autonomousMode);
  };

  process.on('workflow:mode-change', handler);

  // Return cleanup function
  return () => {
    debug('[ModeListener] Removing listener');
    process.removeListener('workflow:mode-change', handler);
  };
}
