/**
 * Step Lifecycle Management
 *
 * Defines the lifecycle phases of a step and validates transitions.
 */

import type { StepData } from './types.js';
import { StepLifecyclePhase } from './types.js';

/**
 * Determines the current lifecycle phase of a step based on its data
 */
export function getStepPhase(stepData: StepData | null): StepLifecyclePhase {
  if (!stepData) {
    return StepLifecyclePhase.NOT_STARTED;
  }

  // If completedAt is set, step is fully completed
  if (stepData.completedAt) {
    return StepLifecyclePhase.COMPLETED;
  }

  // If completedChains exists and has entries, step has chained prompts in progress
  if (stepData.completedChains && stepData.completedChains.length > 0) {
    return StepLifecyclePhase.CHAIN_IN_PROGRESS;
  }

  // If sessionId is set, step session has been initialized
  if (stepData.sessionId) {
    return StepLifecyclePhase.SESSION_INITIALIZED;
  }

  // Step data exists but no session - step has started
  return StepLifecyclePhase.STARTED;
}

/**
 * Checks if a step is considered complete (has completedAt set)
 */
export function isStepComplete(stepData: StepData | null): boolean {
  return stepData?.completedAt !== undefined;
}

/**
 * Checks if a step has incomplete chains (started chains but not fully completed)
 */
export function hasIncompleteChains(stepData: StepData | null): boolean {
  if (!stepData) return false;
  return (
    stepData.completedChains !== undefined &&
    stepData.completedChains.length > 0 &&
    stepData.completedAt === undefined
  );
}

/**
 * Gets the next chain index to resume from
 */
export function getNextChainIndex(stepData: StepData | null): number {
  if (!stepData?.completedChains || stepData.completedChains.length === 0) {
    return 0;
  }
  return Math.max(...stepData.completedChains) + 1;
}

/**
 * Checks if a step is resumable (has session data but not completed)
 */
export function isStepResumable(stepData: StepData | null): boolean {
  if (!stepData) return false;
  return !!stepData.sessionId && !stepData.completedAt;
}
