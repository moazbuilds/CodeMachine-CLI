/**
 * Workflow Listeners
 *
 * Sets up event listeners for workflow control (pause, skip, stop, mode change).
 * Extracted from WorkflowRunner for modularity.
 */

import { debug } from '../../shared/logging/logger.js';
import type { StateMachine } from '../state/index.js';

/**
 * Listener setup options
 */
export interface ListenerOptions {
  machine: StateMachine;
  getAbortController: () => AbortController | null;
  setPauseRequested: (value: boolean) => void;
  setAutoMode: (enabled: boolean) => Promise<void>;
}

/**
 * Set up workflow event listeners
 * Returns cleanup function
 */
export function setupListeners(options: ListenerOptions): () => void {
  const { machine, getAbortController, setPauseRequested, setAutoMode } = options;

  // Pause listener
  const pauseHandler = () => {
    debug('[Listeners] Pause requested');
    setPauseRequested(true);
    getAbortController()?.abort();
  };
  process.on('workflow:pause', pauseHandler);

  // Skip listener (Ctrl+S while agent running)
  const skipHandler = () => {
    debug('[Listeners] Skip requested');
    getAbortController()?.abort();
  };
  process.on('workflow:skip', skipHandler);

  // Stop listener
  const stopHandler = () => {
    debug('[Listeners] Stop requested');
    getAbortController()?.abort();
    machine.send({ type: 'STOP' });
  };
  process.on('workflow:stop', stopHandler);

  // Mode change listener
  const modeChangeHandler = async (data: { autonomousMode: boolean }) => {
    debug('[Listeners] Mode change: autoMode=%s', data.autonomousMode);
    // If in waiting state, let the provider's listener handle it
    // The provider will return __SWITCH_TO_AUTO__ or __SWITCH_TO_MANUAL__
    // and handleWaiting() will call setAutoMode()
    if (machine.state === 'waiting') {
      debug('[Listeners] In waiting state, provider will handle mode switch');
      return;
    }
    // In other states (running, idle), set auto mode directly
    await setAutoMode(data.autonomousMode);
  };
  process.on('workflow:mode-change', modeChangeHandler);

  // Return cleanup function
  const cleanup = () => {
    process.removeListener('workflow:pause', pauseHandler);
    process.removeListener('workflow:skip', skipHandler);
    process.removeListener('workflow:stop', stopHandler);
    process.removeListener('workflow:mode-change', modeChangeHandler);
  };

  // Auto cleanup on machine final state
  const unsubscribe = machine.subscribe(() => {
    if (machine.isFinal) {
      cleanup();
      unsubscribe();
    }
  });

  return cleanup;
}
