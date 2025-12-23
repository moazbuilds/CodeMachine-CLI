/**
 * Step Context Utilities
 *
 * Functions to create and manage step-level context.
 * This is the single source of truth for step-related derived values.
 */

import type { ModuleStep } from '../templates/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { StepOutput, QueuedPrompt } from '../state/types.js';
import type { StepContext, InputContext } from './types.js';

/**
 * Generate unique agent ID for a step
 *
 * This is THE single place where this ID format is defined.
 * All code should use this function instead of constructing the ID manually.
 *
 * @param step - The step definition
 * @param stepIndex - The step index (0-based)
 * @returns Unique agent ID (e.g., "po-agent-step-0")
 */
export function getUniqueAgentId(step: ModuleStep, stepIndex: number): string {
  return `${step.agentId}-step-${stepIndex}`;
}

/**
 * Options for creating a step context
 */
export interface CreateStepContextOptions {
  /** The step definition */
  step: ModuleStep;

  /** Step index (0-based) */
  stepIndex: number;

  /** Total steps in workflow */
  totalSteps: number;

  /** Working directory */
  cwd: string;

  /** CodeMachine root directory */
  cmRoot: string;

  /** Event emitter for UI updates */
  emitter: WorkflowEventEmitter;

  /** Output from the previous/current step execution */
  stepOutput?: StepOutput | null;

  /** Monitoring ID for the current step */
  monitoringId?: number;

  /** Queued prompts (chained prompts) */
  promptQueue?: QueuedPrompt[];

  /** Current index in prompt queue */
  promptQueueIndex?: number;
}

/**
 * Create a step context
 *
 * Call this once when a step starts. The returned context contains
 * all derived values (like uniqueAgentId) so no component needs to
 * calculate them again.
 *
 * @param options - Step context options
 * @returns Complete step context
 */
export function createStepContext(options: CreateStepContextOptions): StepContext {
  const {
    step,
    stepIndex,
    totalSteps,
    cwd,
    cmRoot,
    emitter,
    stepOutput = null,
    monitoringId,
    promptQueue = [],
    promptQueueIndex = 0,
  } = options;

  return {
    step,
    stepIndex,
    totalSteps,
    uniqueAgentId: getUniqueAgentId(step, stepIndex),
    cwd,
    cmRoot,
    emitter,
    stepOutput,
    monitoringId,
    promptQueue,
    promptQueueIndex,
  };
}

/**
 * Create input context from step context
 *
 * Input providers receive a subset of the step context.
 * This function extracts the relevant fields.
 *
 * @param stepCtx - The full step context
 * @param stepOutput - The step output (required for input context)
 * @returns Input context for input providers
 */
export function createInputContext(
  stepCtx: StepContext,
  stepOutput: StepOutput
): InputContext {
  return {
    step: stepCtx.step,
    stepIndex: stepCtx.stepIndex,
    totalSteps: stepCtx.totalSteps,
    uniqueAgentId: stepCtx.uniqueAgentId,
    cwd: stepCtx.cwd,
    emitter: stepCtx.emitter,
    promptQueue: stepCtx.promptQueue,
    promptQueueIndex: stepCtx.promptQueueIndex,
    stepOutput,
  };
}

/**
 * Update step context with new values (immutable)
 *
 * Returns a new context with the updated values.
 * Use this when step state changes (e.g., new output, queue index change).
 *
 * @param stepCtx - The current step context
 * @param updates - Partial updates to apply
 * @returns New step context with updates applied
 */
export function updateStepContext(
  stepCtx: StepContext,
  updates: Partial<Pick<StepContext, 'stepOutput' | 'monitoringId' | 'promptQueue' | 'promptQueueIndex'>>
): StepContext {
  return {
    ...stepCtx,
    ...updates,
  };
}
