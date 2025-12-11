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

  // Check if it's a file not found error (ENOENT, PlaceholderError, or similar)
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'unknown';
  debug(`[DEBUG workflow] Error name: ${errorName}, checking for file not found...`);

  const isFileNotFoundError = error instanceof Error && (
    errorMessage.includes('ENOENT') ||
    errorMessage.includes('not found') ||
    errorMessage.includes('Expected file:') ||
    error.name === 'PlaceholderError'
  );

  debug(`[DEBUG workflow] isFileNotFoundError=${isFileNotFoundError}`);

  if (isFileNotFoundError) {
    const engine = step.engine ?? 'unknown';
    const errorMsg = `[CM-E101] ${step.agentName} failed to start

${engine}: ${errorMessage}`;
    debug(`[DEBUG workflow] isFileNotFoundError=true, emitting workflow:error`);
    debug(`[DEBUG workflow] errorMsg=${errorMsg}`);
    emitter.updateAgentStatus(uniqueAgentId, 'failed');

    // Set workflow status to error and emit error event for modal
    // Don't log to output window - the modal will display the error
    debug(`[DEBUG workflow] Calling emitter.setWorkflowStatus('error')`);
    emitter.setWorkflowStatus('error');
    debug(`[DEBUG workflow] Emitting process event 'workflow:error'`);
    (process as NodeJS.EventEmitter).emit('workflow:error', { reason: errorMsg });
    debug(`[DEBUG workflow] Done emitting, returning shouldStop=true`);
    return { adjustIndex: 0, shouldStop: true };
  }

  // Generic error - log and stop
  const engine = step.engine ?? 'unknown';
  const errorMsg = `[CM-E100] ${step.agentName} failed

${engine}: ${error instanceof Error ? error.message : String(error)}`;
  debug(`[DEBUG workflow] Generic error path`);
  debug(`[DEBUG workflow] errorMsg=${errorMsg}`);
  emitter.updateAgentStatus(uniqueAgentId, 'failed');

  // Set workflow status to error and emit error event for modal
  // Don't log to output window - the modal will display the error
  debug(`[DEBUG workflow] Calling emitter.setWorkflowStatus('error') for generic error`);
  emitter.setWorkflowStatus('error');
  debug(`[DEBUG workflow] Emitting process event 'workflow:error' for generic error`);
  (process as NodeJS.EventEmitter).emit('workflow:error', { reason: errorMsg });
  debug(`[DEBUG workflow] Done emitting generic error, returning shouldStop=true`);
  return { adjustIndex: 0, shouldStop: true };
}
