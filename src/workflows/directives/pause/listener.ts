/**
 * Pause Directive Listener
 *
 * Sets up event listener for workflow:pause events (user keypress).
 * Handles everything: log, state machine transition, abort.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { WorkflowEventEmitter } from '../../events/emitter.js';
import type { StateMachine } from '../../state/index.js';
import type { StepContext } from '../manager/types.js';

export interface PauseListenerOptions {
  getAbortController: () => AbortController | null;
  getStepContext: () => StepContext | null;
  emitter: WorkflowEventEmitter;
  machine: StateMachine;
}

/**
 * Create pause event listener that handles everything
 * Returns cleanup function to remove the listener
 */
export function createPauseListener(options: PauseListenerOptions): () => void {
  const { getAbortController, getStepContext, emitter, machine } = options;

  const handler = () => {
    debug('[PauseListener] workflow:pause event received, state=%s', machine.state);

    const stepContext = getStepContext();
    if (!stepContext) {
      debug('[PauseListener] No step context, ignoring pause');
      return;
    }

    // Log pause message
    emitter.logMessage(stepContext.agentId, `${stepContext.agentName} paused.`);

    // Abort step if running
    if (machine.state === 'running') {
      machine.send({ type: 'PAUSE' });
      getAbortController()?.abort();
    }

    // Abort controller if active (mode-change will be ignored if not in auto mode)
    process.emit('workflow:mode-change' as any, { autonomousMode: false });

    debug('[PauseListener] Pause handled');
  };

  process.on('workflow:pause', handler);

  // Return cleanup function
  return () => {
    debug('[PauseListener] Removing listener');
    process.removeListener('workflow:pause', handler);
  };
}
