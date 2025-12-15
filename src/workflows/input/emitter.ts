/**
 * Input Event Emitter
 *
 * Bridges input providers with the workflow event system.
 * Emits events that TUI can subscribe to.
 */

import { debug } from '../../shared/logging/logger.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type {
  InputEventEmitter,
  WaitingEventData,
  ReceivedEventData,
} from './types.js';

/**
 * Create an input event emitter that uses the workflow event bus
 */
export function createInputEmitter(workflowEmitter: WorkflowEventEmitter): InputEventEmitter {
  return {
    emitWaiting(data: WaitingEventData): void {
      debug('[InputEmitter] Emitting waiting: step=%d, queueLength=%d',
        data.stepIndex, data.promptQueue.length);

      workflowEmitter.setInputState({
        active: true,
        queuedPrompts: data.promptQueue.map(p => ({
          name: p.name,
          label: p.label,
          content: p.content,
        })),
        currentIndex: data.promptQueueIndex,
        monitoringId: data.monitoringId,
      });
    },

    emitReceived(data: ReceivedEventData): void {
      debug('[InputEmitter] Emitting received: source=%s, inputLength=%d',
        data.source, data.input.length);

      // Clear input state
      workflowEmitter.setInputState(null);
    },

    emitCanceled(): void {
      debug('[InputEmitter] Emitting canceled');

      // Clear input state
      workflowEmitter.setInputState(null);
    },
  };
}

/**
 * Null emitter for testing or when no TUI is present
 */
export const nullInputEmitter: InputEventEmitter = {
  emitWaiting: () => {},
  emitReceived: () => {},
  emitCanceled: () => {},
};
