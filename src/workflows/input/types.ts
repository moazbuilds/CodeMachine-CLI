/**
 * Input Provider Types
 *
 * Strategy pattern for input sources (user, controller, queue).
 * Each provider implements the same interface but gets input differently.
 */

import type { StepOutput, QueuedPrompt } from '../state/types.js';
import type { ModuleStep } from '../templates/types.js';

/**
 * Context passed to input providers
 */
export interface InputContext {
  /** The step definition */
  step: ModuleStep;

  /** Output from the completed step */
  stepOutput: StepOutput;

  /** Current step index */
  stepIndex: number;

  /** Total steps in workflow */
  totalSteps: number;

  /** Queued prompts (chained prompts from agent config) */
  promptQueue: QueuedPrompt[];

  /** Current index in prompt queue */
  promptQueueIndex: number;

  /** Working directory */
  cwd: string;

  /** Unique agent ID for the current step (for telemetry attribution) */
  uniqueAgentId?: string;
}

/**
 * Result from an input provider
 */
export type InputResult =
  | { type: 'input'; value: string; resumeMonitoringId?: number; source?: 'user' | 'controller' }
  | { type: 'skip' }
  | { type: 'stop' };

/**
 * Input provider interface
 *
 * Implementations:
 * - UserInputProvider: Waits for user to type in TUI
 * - ControllerInputProvider: Gets input from controller agent
 * - QueueInputProvider: Uses next item from prompt queue
 */
export interface InputProvider {
  /** Unique identifier for this provider */
  readonly id: string;

  /**
   * Get input for the next step
   * Called when workflow enters 'awaiting' state
   */
  getInput(context: InputContext): Promise<InputResult>;

  /**
   * Called when provider is activated (becomes the active source)
   * Use for setup, emitting events, etc.
   */
  activate?(): void;

  /**
   * Called when provider is deactivated (another source takes over)
   * Use for cleanup, canceling pending operations, etc.
   */
  deactivate?(): void;

  /**
   * Called to abort any pending input wait
   * Used when pausing or stopping workflow
   */
  abort?(): void;
}

/**
 * Composite input provider that tries providers in order
 */
export interface CompositeInputProvider extends InputProvider {
  /** Add a provider to the chain */
  addProvider(provider: InputProvider): void;

  /** Remove a provider from the chain */
  removeProvider(id: string): void;

  /** Set the active provider by id */
  setActive(id: string): void;
}

/**
 * Event emitter interface for input state changes
 */
export interface InputEventEmitter {
  /** Emit that we're waiting for input */
  emitWaiting(data: WaitingEventData): void;

  /** Emit that input was received */
  emitReceived(data: ReceivedEventData): void;

  /** Emit that input was canceled */
  emitCanceled(): void;
}

/**
 * Data for waiting event
 */
export interface WaitingEventData {
  stepIndex: number;
  promptQueue: QueuedPrompt[];
  promptQueueIndex: number;
  monitoringId?: number;
}

/**
 * Data for received event
 */
export interface ReceivedEventData {
  input: string;
  source: 'user' | 'controller' | 'queue';
  /** Queue info to preserve step indicator while agent runs */
  promptQueue?: QueuedPrompt[];
  promptQueueIndex?: number;
}
