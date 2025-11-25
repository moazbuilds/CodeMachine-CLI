/**
 * UI Adapter Interface Types
 *
 * Defines the contract between workflow execution and UI implementations.
 * Any UI (TUI, headless, test mock) must implement IWorkflowUI.
 */

import type { WorkflowEventBus } from '../../../../../workflows/events/index.js';

/**
 * User action callbacks - UI triggers these to control workflow
 */
export interface WorkflowUserActions {
  /** User requested to skip current agent (Ctrl+S) */
  onSkip?: () => void;

  /** User requested to quit workflow (Ctrl+C) */
  onQuit?: () => void;

  /** User chose to continue from checkpoint */
  onCheckpointContinue?: () => void;

  /** User chose to quit from checkpoint */
  onCheckpointQuit?: () => void;
}

/**
 * UI Adapter configuration options
 */
export interface UIAdapterOptions {
  /** Workflow name for display */
  workflowName?: string;

  /** Total number of steps in workflow */
  totalSteps?: number;

  /** Path for debug logs */
  debugLogPath?: string;

  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * IWorkflowUI - The main interface any UI adapter must implement
 *
 * This interface decouples workflow execution from UI rendering.
 * The workflow emits events via WorkflowEventBus, and the adapter
 * subscribes to those events to update its UI.
 *
 * Flow:
 * 1. Workflow creates adapter: `const ui = createAdapter(options)`
 * 2. Workflow creates event bus: `const bus = new WorkflowEventBus()`
 * 3. Connect adapter to bus: `ui.connect(bus)`
 * 4. Start UI: `ui.start()`
 * 5. Workflow emits events: `bus.emit({ type: 'agent:status', ... })`
 * 6. Adapter receives events and updates UI
 * 7. User actions flow back via callbacks: `ui.onSkip = () => ...`
 * 8. Cleanup: `ui.stop()` then `ui.disconnect()`
 */
export interface IWorkflowUI extends WorkflowUserActions {
  /**
   * Connect to a workflow event bus
   * The adapter will subscribe to events and update UI accordingly
   */
  connect(eventBus: WorkflowEventBus): void;

  /**
   * Disconnect from the event bus
   * Unsubscribes all event listeners
   */
  disconnect(): void;

  /**
   * Start the UI
   * For TUI: renders the interface
   * For headless: initializes logging
   * For mock: prepares event recording
   */
  start(): void;

  /**
   * Stop the UI
   * Cleanup resources, unmount components, close streams
   */
  stop(): void;

  /**
   * Check if UI is currently running
   */
  isRunning(): boolean;

  /**
   * Check if connected to an event bus
   */
  isConnected(): boolean;
}

/**
 * Factory function type for creating UI adapters
 */
export type UIAdapterFactory = (options?: UIAdapterOptions) => IWorkflowUI;

/**
 * Adapter type identifier
 */
export type AdapterType = 'opentui' | 'headless' | 'mock';
