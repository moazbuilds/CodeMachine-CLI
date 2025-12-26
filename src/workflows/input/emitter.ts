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
  // Persist queue state across emissions - only clear on explicit cancel/workflow end
  let persistedQueue: { name: string; label: string; content: string }[] = [];
  let persistedIndex = 0;

  return {
    emitWaiting(data: WaitingEventData): void {
      debug('[InputEmitter] Emitting waiting: step=%d, queueLength=%d',
        data.stepIndex, data.promptQueue.length);

      // Update persisted queue
      persistedQueue = data.promptQueue.map(p => ({
        name: p.name,
        label: p.label,
        content: p.content,
      }));
      persistedIndex = data.promptQueueIndex;

      workflowEmitter.setInputState({
        active: true,
        queuedPrompts: persistedQueue,
        currentIndex: persistedIndex,
        monitoringId: data.monitoringId,
      });
    },

    emitReceived(data: ReceivedEventData): void {
      debug('[InputEmitter] Emitting received: source=%s, inputLength=%d',
        data.source, data.input.length);

      // Update persisted state if queue provided
      if (data.promptQueue && data.promptQueue.length > 0) {
        persistedQueue = data.promptQueue.map(p => ({
          name: p.name,
          label: p.label,
          content: p.content,
        }));
        persistedIndex = data.promptQueueIndex ?? 0;
      } else if (data.promptQueueIndex !== undefined) {
        // Just update index if provided
        persistedIndex = data.promptQueueIndex;
      }

      // Always emit with persisted queue (never clear mid-workflow)
      workflowEmitter.setInputState({
        active: false,
        queuedPrompts: persistedQueue,
        currentIndex: persistedIndex,
      });
    },

    emitCanceled(): void {
      debug('[InputEmitter] Emitting canceled');

      // Clear persisted state and input state
      persistedQueue = [];
      persistedIndex = 0;
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
