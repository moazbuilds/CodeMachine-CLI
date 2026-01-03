/**
 * Loop Action
 *
 * Handles looping back to a previous step in the workflow.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { RunnerContext } from '../types.js';
import type { ModeHandlerResult } from '../modes/types.js';
import { getUniqueAgentId } from '../../context/index.js';
import { StatusService } from '../../../agents/monitoring/index.js';

/**
 * Loop to target step
 *
 * Rewinds the workflow to a previous step index.
 */
export async function loopToStep(
  ctx: RunnerContext,
  targetIndex: number
): Promise<ModeHandlerResult> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  debug('[actions/loop] Looping from step %d to step %d', stepIndex, targetIndex);

  // Update UI
  const status = StatusService.getInstance();
  status.completed(uniqueAgentId);

  // Mark current step completed
  await ctx.indexManager.stepCompleted(stepIndex);

  // Reset queue
  ctx.indexManager.resetQueue();

  // Set target index directly on machine context
  // INPUT_RECEIVED will NOT increment this since we're setting it directly
  machineCtx.currentStepIndex = targetIndex;

  // Transition FSM
  ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });

  return { type: 'loop', targetIndex };
}
