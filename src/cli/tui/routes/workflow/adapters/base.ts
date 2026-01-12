/**
 * Base UI Adapter
 *
 * Abstract base class providing common functionality for all UI adapters.
 * Handles event bus connection, subscription management, and callback routing.
 */

import type { WorkflowEventBus, Unsubscribe, WorkflowEvent } from '../../../../../workflows/events/index.js';
import type { IWorkflowUI, UIAdapterOptions } from './types.js';

/**
 * BaseUIAdapter - Common implementation for all UI adapters
 *
 * Subclasses must implement:
 * - onStart(): Called when UI should initialize
 * - onStop(): Called when UI should cleanup
 * - handleEvent(): Called for each workflow event
 */
export abstract class BaseUIAdapter implements IWorkflowUI {
  protected eventBus: WorkflowEventBus | null = null;
  protected unsubscribe: Unsubscribe | null = null;
  protected running = false;
  protected options: UIAdapterOptions;

  // User action callbacks
  onSkip?: () => void;
  onQuit?: () => void;
  onCheckpointContinue?: () => void;
  onCheckpointQuit?: () => void;

  constructor(options: UIAdapterOptions = {}) {
    this.options = options;
  }

  /**
   * Connect to workflow event bus
   */
  connect(eventBus: WorkflowEventBus): void {
    if (this.eventBus) {
      this.disconnect();
    }

    this.eventBus = eventBus;

    // Replay history if available to catch missed events
    const history = eventBus.getHistory();
    if (history.length > 0) {
      history.forEach((event) => {
        this.handleEvent(event);
      });
    }

    this.unsubscribe = eventBus.subscribe((event) => {
      this.handleEvent(event);
    });
  }

  /**
   * Disconnect from event bus
   */
  disconnect(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.eventBus = null;
  }

  /**
   * Start the UI
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.onStart();
  }

  /**
   * Stop the UI
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.onStop();
  }

  /**
   * Check if UI is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if connected to event bus
   */
  isConnected(): boolean {
    return this.eventBus !== null;
  }

  /**
   * Emit user action: skip current agent
   */
  protected emitSkip(): void {
    this.onSkip?.();
  }

  /**
   * Emit user action: quit workflow
   */
  protected emitQuit(): void {
    this.onQuit?.();
  }

  /**
   * Emit user action: continue from checkpoint
   */
  protected emitCheckpointContinue(): void {
    this.onCheckpointContinue?.();
  }

  /**
   * Emit user action: quit from checkpoint
   */
  protected emitCheckpointQuit(): void {
    this.onCheckpointQuit?.();
  }

  /**
   * Called when start() is invoked - subclasses implement UI initialization
   */
  protected abstract onStart(): void;

  /**
   * Called when stop() is invoked - subclasses implement UI cleanup
   */
  protected abstract onStop(): void;

  /**
   * Called for each workflow event - subclasses implement event handling
   */
  protected abstract handleEvent(event: WorkflowEvent): void;
}
