/**
 * Crash Recovery Module
 *
 * Handles detection and restoration of workflow steps after crashes.
 * Centralizes all crash recovery logic for maintainability.
 */

import { debug } from '../../shared/logging/logger.js';
import type { StepData } from '../indexing/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { StepIndexManager } from '../indexing/index.js';
import type { StateMachine } from '../state/types.js';
import type { ModuleStep } from '../templates/types.js';
import type { StepSession } from '../session/index.js';

import { detectCrashRecovery } from './detect.js';
import { restoreFromCrash } from './restore.js';
import type {
  CrashDetectionResult,
  CrashRestoreContext,
  CrashRestoreResult,
} from './types.js';

// Re-exports
export { detectCrashRecovery, isCrashRecovery } from './detect.js';
export { restoreFromCrash } from './restore.js';
export type {
  CrashDetectionResult,
  CrashRestoreContext,
  CrashRestoreResult,
} from './types.js';

/**
 * Options for handleCrashRecovery
 */
export interface HandleCrashRecoveryOptions {
  /** Step data from persistence */
  stepData: StepData | null;
  /** Current step definition */
  step: ModuleStep;
  /** Step index */
  stepIndex: number;
  /** Unique agent ID */
  uniqueAgentId: string;
  /** Working directory */
  cwd: string;
  /** .codemachine root */
  cmRoot: string;
  /** Event emitter */
  emitter: WorkflowEventEmitter;
  /** State machine */
  machine: StateMachine;
  /** Index manager */
  indexManager: StepIndexManager;
  /** Current session (optional) */
  session?: StepSession | null;
}

/**
 * Result from handleCrashRecovery
 */
export interface HandleCrashRecoveryResult {
  /** Whether crash recovery was handled */
  handled: boolean;
  /** Detection result */
  detection: CrashDetectionResult;
  /** Restoration result (if handled) */
  restoration?: CrashRestoreResult;
}

/**
 * Main entry point for crash recovery
 *
 * Detects if a step needs crash recovery and performs restoration if needed.
 * Returns whether recovery was handled - caller should skip normal execution if true.
 *
 * @param options - All context needed for recovery
 * @returns Result indicating if recovery was handled
 */
export async function handleCrashRecovery(
  options: HandleCrashRecoveryOptions
): Promise<HandleCrashRecoveryResult> {
  const {
    stepData,
    step,
    stepIndex,
    uniqueAgentId,
    cwd,
    cmRoot,
    emitter,
    machine,
    indexManager,
    session,
  } = options;

  // 1. Detect if crash recovery is needed
  const detection = detectCrashRecovery(stepData);

  if (!detection.isRecovering) {
    debug('[recovery] No crash recovery needed for step %d', stepIndex);
    return { handled: false, detection };
  }

  debug('[recovery] Crash recovery detected for step %d', stepIndex);

  // 2. Perform restoration
  const restoreCtx: CrashRestoreContext = {
    stepData: stepData!, // Safe - detection.isRecovering implies stepData exists
    step,
    stepIndex,
    uniqueAgentId,
    cwd,
    cmRoot,
    emitter,
    machineContext: machine.context,
    indexManager,
    session,
  };

  const restoration = await restoreFromCrash(restoreCtx);

  // 3. Transition state machine to awaiting
  machine.send({
    type: 'STEP_COMPLETE',
    output: { output: '', monitoringId: stepData?.monitoringId },
  });

  debug('[recovery] Crash recovery complete, transitioning to awaiting state');

  return { handled: true, detection, restoration };
}
