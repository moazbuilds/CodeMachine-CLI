import { debug } from '../../shared/logging/logger.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { ModuleStep } from '../templates/types.js';
import type { InputState } from './input.js';

interface HandleStepErrorOptions {
  error: unknown;
  step: ModuleStep;
  index: number;
  inputState: InputState;
  emitter: WorkflowEventEmitter;
  uniqueAgentId: string;
}

interface HandleStepErrorResult {
  adjustIndex: number; // -1 to retry, 0 to continue normally
  shouldStop: boolean;
}

/**
 * Handle step execution errors - pause request, skip/abort, ENOENT, generic errors
 */
export async function handleStepError(options: HandleStepErrorOptions): Promise<HandleStepErrorResult> {
  const {
    error,
    step,
    index,
    inputState,
    emitter,
    uniqueAgentId,
  } = options;

  // Check if this was a pause request (process killed)
  if (inputState.requested) {
    emitter.logMessage(uniqueAgentId, `${step.agentName} paused.`);

    // Store step index and activate input state for resume
    inputState.stepIndex = index;
    inputState.active = true;
    inputState.requested = false;

    // Emit input state to TUI
    emitter.setInputState({
      active: true,
      queuedPrompts: [],
      currentIndex: 0,
      monitoringId: inputState.monitoringId,
    });

    // Wait for user input
    await new Promise<void>((resolve) => {
      inputState.resolver = resolve;
    });

    // Re-run this step by not incrementing index (continue skips the for-loop increment)
    return { adjustIndex: -1, shouldStop: false };
  }

  if (error instanceof Error && error.name === 'AbortError') {
    // Check if this was a user-requested skip (abort)
    debug(`[DEBUG workflow] Step ${index} (${uniqueAgentId}) was aborted by user`);
    emitter.updateAgentStatus(uniqueAgentId, 'skipped');
    emitter.logMessage(uniqueAgentId, `${step.agentName} was skipped by user.`);
    emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
    // Continue to next step - don't throw
    return { adjustIndex: 0, shouldStop: false };
  }

  // Error occurred - log it and stop the workflow
  debug(`[DEBUG workflow] Step ${index} (${uniqueAgentId}) failed with error: ${error instanceof Error ? error.message : String(error)}`);

  // Check if it's a file not found error
  if (error instanceof Error && (error.message.includes('ENOENT') || error.message.includes('not found'))) {
    const errorMsg = `CRITICAL ERROR: ${step.agentName} failed - required file not found: ${error.message}`;
    emitter.updateAgentStatus(uniqueAgentId, 'failed');
    emitter.logMessage(uniqueAgentId, errorMsg);

    // Set workflow status to stopped and stop
    emitter.setWorkflowStatus('stopped');
    return { adjustIndex: 0, shouldStop: true };
  }

  // Generic error - log and stop
  const failMsg = `${step.agentName} failed: ${error instanceof Error ? error.message : String(error)}`;
  emitter.logMessage(uniqueAgentId, failMsg);
  emitter.updateAgentStatus(uniqueAgentId, 'failed');

  // Set workflow status to stopped and stop
  emitter.setWorkflowStatus('stopped');
  return { adjustIndex: 0, shouldStop: true };
}
