/**
 * Crash Recovery Types
 *
 * Types specific to crash recovery operations.
 */

import type { StepData } from '../indexing/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { StepIndexManager } from '../indexing/index.js';
import type { WorkflowContext } from '../state/types.js';
import type { ModuleStep } from '../templates/types.js';
import type { StepSession } from '../session/index.js';

/**
 * Result of crash recovery detection
 */
export interface CrashDetectionResult {
  /** Whether this step is resuming from a crash */
  isRecovering: boolean;
  /** Session ID to resume (if recovering) */
  sessionId?: string;
  /** Monitoring ID to resume (if recovering) */
  monitoringId?: number;
  /** Completed chain indices (if any) */
  completedChains?: number[];
}

/**
 * Context needed for crash recovery restoration
 */
export interface CrashRestoreContext {
  /** Step data containing session info */
  stepData: StepData;
  /** Current step definition */
  step: ModuleStep;
  /** Step index */
  stepIndex: number;
  /** Unique agent ID for this step */
  uniqueAgentId: string;
  /** Working directory */
  cwd: string;
  /** .codemachine root directory */
  cmRoot: string;
  /** Event emitter for UI updates */
  emitter: WorkflowEventEmitter;
  /** State machine context */
  machineContext: WorkflowContext;
  /** Index manager for queue operations */
  indexManager: StepIndexManager;
  /** Current step session (optional) */
  session?: StepSession | null;
}

/**
 * Result of crash recovery restoration
 */
export interface CrashRestoreResult {
  /** Whether restoration was successful */
  success: boolean;
  /** Queue was restored with chained prompts */
  queueRestored: boolean;
  /** Number of prompts in restored queue */
  promptCount: number;
  /** Resume index in the queue */
  resumeIndex: number;
}
