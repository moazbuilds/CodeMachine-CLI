/**
 * Workflow Event Bus
 *
 * A typed EventEmitter that decouples workflow execution from UI.
 * Supports both general subscriptions and type-specific listeners.
 */

import type {
  WorkflowEvent,
  WorkflowEventType,
  WorkflowEventListener,
  WorkflowEventPayload,
  TypedEventListener,
} from './types.js';

/**
 * Unsubscribe function returned by subscribe methods
 */
export type Unsubscribe = () => void;

/**
 * WorkflowEventBus - Central hub for workflow → UI communication
 *
 * Usage:
 * ```typescript
 * const bus = new WorkflowEventBus();
 *
 * // Subscribe to all events
 * const unsub = bus.subscribe((event) => {
 *   console.log(event.type, event);
 * });
 *
 * // Subscribe to specific event type
 * bus.on('agent:status', (event) => {
 *   console.log(event.agentId, event.status);
 * });
 *
 * // Emit events
 * bus.emit({ type: 'agent:status', agentId: '123', status: 'running' });
 *
 * // Cleanup
 * unsub();
 * ```
 */
export class WorkflowEventBus {
  private listeners = new Set<WorkflowEventListener>();
  private typedListeners = new Map<WorkflowEventType, Set<TypedEventListener<any>>>();
  private eventHistory: WorkflowEvent[] = [];
  private historyEnabled = false;
  private maxHistorySize = 1000;

  /**
   * Subscribe to ALL workflow events
   * @returns Unsubscribe function
   */
  subscribe(listener: WorkflowEventListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to a specific event type
   * @returns Unsubscribe function
   */
  on<T extends WorkflowEventType>(
    eventType: T,
    listener: TypedEventListener<T>
  ): Unsubscribe {
    if (!this.typedListeners.has(eventType)) {
      this.typedListeners.set(eventType, new Set());
    }
    this.typedListeners.get(eventType)!.add(listener);

    return () => {
      const set = this.typedListeners.get(eventType);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.typedListeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribe to a specific event type (once only)
   * @returns Unsubscribe function (in case you want to cancel before event fires)
   */
  once<T extends WorkflowEventType>(
    eventType: T,
    listener: TypedEventListener<T>
  ): Unsubscribe {
    const wrapper: TypedEventListener<T> = (event) => {
      unsub();
      listener(event);
    };
    const unsub = this.on(eventType, wrapper);
    return unsub;
  }

  /**
   * Emit a workflow event to all subscribers
   */
  emit(event: WorkflowEvent): void {
    // Record in history if enabled
    if (this.historyEnabled) {
      this.eventHistory.push(event);
      if (this.eventHistory.length > this.maxHistorySize) {
        this.eventHistory.shift();
      }
    }

    // Notify general listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`[WorkflowEventBus] Error in listener:`, error);
      }
    }

    // Notify typed listeners
    const typedSet = this.typedListeners.get(event.type);
    if (typedSet) {
      for (const listener of typedSet) {
        try {
          listener(event as WorkflowEventPayload<typeof event.type>);
        } catch (error) {
          console.error(`[WorkflowEventBus] Error in typed listener for ${event.type}:`, error);
        }
      }
    }
  }

  /**
   * Enable event history recording (useful for debugging/testing)
   */
  enableHistory(maxSize = 1000): void {
    this.historyEnabled = true;
    this.maxHistorySize = maxSize;
  }

  /**
   * Disable event history recording
   */
  disableHistory(): void {
    this.historyEnabled = false;
  }

  /**
   * Get recorded event history (if enabled)
   */
  getHistory(): readonly WorkflowEvent[] {
    return this.eventHistory;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get all events of a specific type from history
   */
  getHistoryByType<T extends WorkflowEventType>(
    eventType: T
  ): WorkflowEventPayload<T>[] {
    return this.eventHistory.filter(
      (e): e is WorkflowEventPayload<T> => e.type === eventType
    );
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.typedListeners.clear();
  }

  /**
   * Get listener count (for debugging)
   */
  listenerCount(): { general: number; typed: Map<WorkflowEventType, number> } {
    const typed = new Map<WorkflowEventType, number>();
    for (const [type, set] of this.typedListeners) {
      typed.set(type, set.size);
    }
    return {
      general: this.listeners.size,
      typed,
    };
  }

  /**
   * Check if there are any subscribers
   * Used to detect if TUI is connected (headless vs interactive mode)
   */
  hasSubscribers(): boolean {
    if (this.listeners.size > 0) return true;
    for (const set of this.typedListeners.values()) {
      if (set.size > 0) return true;
    }
    return false;
  }
}

/**
 * Create a new WorkflowEventBus instance
 */
export function createWorkflowEventBus(): WorkflowEventBus {
  return new WorkflowEventBus();
}
