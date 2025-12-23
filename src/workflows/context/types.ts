/**
 * Workflow Context Types
 *
 * Centralized context definitions for workflow execution.
 * These contexts flow through the system - calculated once, read everywhere.
 */

import type { ModuleStep } from '../templates/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { StepOutput, QueuedPrompt } from '../state/types.js';

/**
 * Step-level context - created once when a step starts
 *
 * Contains everything needed to execute and track a single step.
 * This is the "single source of truth" for step-related data.
 *
 * Usage:
 * ```typescript
 * const stepCtx = createStepContext(workflowCtx, stepIndex);
 * // Now everyone uses stepCtx.uniqueAgentId - no derivation!
 * ```
 */
export interface StepContext {
  /** The step definition */
  step: ModuleStep;

  /** Step index (0-based) */
  stepIndex: number;

  /** Total steps in workflow */
  totalSteps: number;

  /** Unique agent ID for UI/telemetry (e.g., "po-agent-step-0") */
  uniqueAgentId: string;

  /** Working directory */
  cwd: string;

  /** CodeMachine root directory */
  cmRoot: string;

  /** Event emitter for UI updates */
  emitter: WorkflowEventEmitter;

  /** Output from the previous/current step execution */
  stepOutput: StepOutput | null;

  /** Monitoring ID for the current step */
  monitoringId?: number;

  /** Queued prompts (chained prompts) */
  promptQueue: QueuedPrompt[];

  /** Current index in prompt queue */
  promptQueueIndex: number;
}

/**
 * Input context - subset of StepContext passed to input providers
 *
 * This extends the essential step info with input-specific data.
 * Input providers receive this when waiting for user/controller input.
 */
export interface InputContext extends Pick<
  StepContext,
  | 'step'
  | 'stepIndex'
  | 'totalSteps'
  | 'uniqueAgentId'
  | 'cwd'
  | 'emitter'
  | 'promptQueue'
  | 'promptQueueIndex'
> {
  /** Output from the completed step */
  stepOutput: StepOutput;
}

/**
 * Result from an input provider
 */
export type InputResult =
  | { type: 'input'; value: string; resumeMonitoringId?: number; source?: 'user' | 'controller' }
  | { type: 'skip' }
  | { type: 'stop' };
