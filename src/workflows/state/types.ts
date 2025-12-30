/**
 * Workflow State Machine Types
 *
 * Defines the states, events, and context for workflow execution.
 *
 * Note: Queue state (promptQueue, promptQueueIndex) is managed by StepIndexManager.
 * See src/workflows/indexing/ for the single source of truth.
 */

import type { ModuleStep } from '../templates/types.js';

/**
 * Workflow states - mutually exclusive
 */
export type WorkflowState =
  | 'idle'              // Not started
  | 'running'           // Agent executing (input disabled)
  | 'awaiting'          // Awaiting user input (input enabled)
  | 'delegated'         // Controller agent is running (autonomous mode)
  | 'completed'         // All steps done
  | 'stopped'           // User stopped
  | 'error';            // Fatal error

/**
 * Events that trigger state transitions
 */
export type WorkflowEvent =
  | { type: 'START' }
  | { type: 'STEP_COMPLETE'; output: StepOutput }
  | { type: 'STEP_ERROR'; error: Error }
  | { type: 'INPUT_RECEIVED'; input: string }
  | { type: 'RESUME' }
  | { type: 'SKIP' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'DELEGATE' }   // Switch from awaiting to delegated (mode change to auto)
  | { type: 'AWAIT' };     // Switch from delegated to awaiting (mode change to manual)

/**
 * Output from a completed step
 */
export interface StepOutput {
  output: string;
  monitoringId?: number;
  sessionId?: string;
}

/**
 * Workflow context - mutable data carried through execution
 */
export interface WorkflowContext {
  // Step tracking
  currentStepIndex: number;
  totalSteps: number;
  steps: ModuleStep[];

  // Current execution
  currentOutput: StepOutput | null;
  currentMonitoringId?: number;

  // Input mode
  autoMode: boolean;

  // Pause state
  paused: boolean;

  // Paths
  cwd: string;
  cmRoot: string;

  // Error tracking
  lastError?: Error;
}

/**
 * Queued prompt for chained execution
 */
export interface QueuedPrompt {
  name: string;
  label: string;
  content: string;
}

/**
 * State machine definition
 */
export interface StateMachine {
  /** Current state */
  readonly state: WorkflowState;

  /** Current context */
  readonly context: WorkflowContext;

  /** Send an event to trigger transition */
  send(event: WorkflowEvent): void;

  /** Subscribe to state changes */
  subscribe(listener: StateListener): () => void;

  /** Check if in final state */
  readonly isFinal: boolean;
}

/**
 * Listener for state changes
 */
export type StateListener = (state: WorkflowState, context: WorkflowContext) => void;

/**
 * Transition definition
 */
export interface Transition {
  target: WorkflowState;
  guard?: (context: WorkflowContext) => boolean;
  action?: (context: WorkflowContext, event: WorkflowEvent) => void;
}

/**
 * State definition with transitions
 */
export interface StateDefinition {
  on?: Partial<Record<WorkflowEvent['type'], Transition | Transition[]>>;
  onEnter?: (context: WorkflowContext) => void;
  onExit?: (context: WorkflowContext) => void;
}

/**
 * Machine configuration
 */
export interface MachineConfig {
  id: string;
  initial: WorkflowState;
  context: WorkflowContext;
  states: Record<WorkflowState, StateDefinition>;
}
