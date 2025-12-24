/**
 * StepSession Types
 *
 * Owns step lifecycle and promptQueue for each step execution.
 */

import type { ModuleStep } from '../templates/types.js';
import type { StepOutput, QueuedPrompt } from '../state/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';

/**
 * Session state lifecycle
 */
export type StepSessionState = 'idle' | 'running' | 'awaiting' | 'completed';

/**
 * Configuration for creating a StepSession
 */
export interface StepSessionConfig {
  /** Step index in workflow */
  stepIndex: number;

  /** Step definition */
  step: ModuleStep;

  /** Working directory */
  cwd: string;

  /** CodeMachine root directory */
  cmRoot: string;

  /** Event emitter for status updates */
  emitter: WorkflowEventEmitter;

  /** Unique agent ID for this step (includes step index suffix) */
  uniqueAgentId: string;
}

/**
 * Result from running a step session
 */
export interface StepSessionResult {
  /** Step output */
  output: StepOutput;

  /** Whether to advance to next step */
  shouldAdvance: boolean;

  /** Whether workflow should stop (e.g., from directive) */
  shouldStop?: boolean;

  /** New step index (for loops) */
  newIndex?: number;

  /** Whether checkpoint was continued */
  checkpointContinued?: boolean;
}

/**
 * Options for resuming a session
 */
export interface ResumeOptions {
  /** User input for resume */
  input: string;

  /** Monitoring ID for resume */
  monitoringId?: number;

  /** Source of the input */
  source?: 'user' | 'controller';
}

/**
 * Persisted session data for crash recovery
 */
export interface PersistedSessionData {
  /** Session ID from engine */
  sessionId: string;

  /** Monitoring ID */
  monitoringId?: number;

  /** Chained prompts queue */
  promptQueue: QueuedPrompt[];

  /** Current index in prompt queue */
  promptQueueIndex: number;
}
