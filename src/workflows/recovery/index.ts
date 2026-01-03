/**
 * Crash Recovery Module
 *
 * Handles detection and restoration of workflow steps after crashes.
 * Centralizes all crash recovery logic for maintainability.
 */

import { debug } from '../../shared/logging/logger.js';
import { DEFAULT_CONTINUATION_PROMPT } from '../../shared/prompts/index.js';
import type { StepData } from '../indexing/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { StepIndexManager } from '../indexing/index.js';
import type { StateMachine } from '../state/types.js';
import type { ModuleStep } from '../templates/types.js';
import type { StepSession } from '../session/index.js';
import { StatusService } from '../../agents/monitoring/index.js';

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
 * Options for sending recovery prompt
 */
export interface SendRecoveryPromptOptions {
  /** Prompt to send */
  resumePrompt: string;
  /** Monitoring ID for the session */
  resumeMonitoringId?: number;
  /** Source of the prompt */
  source: 'controller';
}

/**
 * Callback to send recovery prompt to agent
 */
export type SendRecoveryPromptFn = (options: SendRecoveryPromptOptions) => Promise<void>;

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
  /** Callback to send recovery prompt (required for auto mode recovery) */
  sendRecoveryPrompt?: SendRecoveryPromptFn;
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

  // 3. Handle recovery based on mode
  const isAutoMode = machine.context.autoMode;

  if (isAutoMode) {
    // Auto mode: Send recovery prompt directly before transitioning
    // This centralizes all recovery logic here instead of scattering to wait.ts/delegated.ts
    if (!options.sendRecoveryPrompt) {
      throw new Error('[recovery] Auto mode crash recovery requires sendRecoveryPrompt callback');
    }

    debug('[recovery] Auto mode: sending recovery prompt to agent');
    const status = StatusService.getInstance();
    status.running(uniqueAgentId);

    // Mark continuation prompt as sent to prevent handleDelegated from sending again
    machine.context.continuationPromptSent = true;

    // Transition to running state before sending prompt
    machine.send({ type: 'RESUME' });

    // Send recovery prompt and wait for agent response
    await options.sendRecoveryPrompt({
      resumePrompt: DEFAULT_CONTINUATION_PROMPT,
      resumeMonitoringId: stepData?.monitoringId,
      source: 'controller',
    });

    debug('[recovery] Recovery prompt sent, agent responded');

    // After agent responds, the state machine will have transitioned to awaiting/delegated
    // The normal flow will continue from there (chained prompts, etc.)
    debug('[recovery] Crash recovery complete (auto mode)');
  } else {
    // Manual mode: Pause and wait for user input
    machine.context.paused = true;

    machine.send({
      type: 'STEP_COMPLETE',
      output: { output: '', monitoringId: stepData?.monitoringId },
    });

    debug('[recovery] Crash recovery complete, transitioning to awaiting state (manual mode, paused)');
  }

  return { handled: true, detection, restoration };
}
