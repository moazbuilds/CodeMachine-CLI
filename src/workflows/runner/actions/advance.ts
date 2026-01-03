/**
 * Advance Action
 *
 * Handles advancing to the next step in the workflow.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { RunnerContext } from '../types.js';
import type { ModeHandlerResult } from '../modes/types.js';
import { getUniqueAgentId } from '../../context/index.js';
import { StatusService } from '../../../agents/monitoring/index.js';

/**
 * Advance to next step
 *
 * Completes the current step and transitions to the next one.
 */
export async function advanceToNextStep(ctx: RunnerContext): Promise<ModeHandlerResult> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);
  const session = ctx.getCurrentSession();

  debug('[actions/advance] Advancing from step %d to next step', stepIndex);

  const status = StatusService.getInstance();

  // Complete session if exists
  if (session) {
    await session.complete();
  }

  // Update UI
  status.completed(uniqueAgentId);

  // Reset queue and UI state to prevent leaking to next step
  ctx.indexManager.resetQueue();
  ctx.emitter.setInputState(null);

  // Mark step completed
  await ctx.indexManager.stepCompleted(stepIndex);

  // Resume from paused state if needed
  ctx.mode.resume();
  machineCtx.paused = false;

  // Transition FSM
  ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });

  return { type: 'advance' };
}

/**
 * Skip current step
 *
 * Marks the current step as skipped and moves to the next one.
 */
export async function skipStep(ctx: RunnerContext): Promise<ModeHandlerResult> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  debug('[actions/advance] Skipping step %d', stepIndex);

  const status = StatusService.getInstance();

  // Resume from paused state
  ctx.mode.resume();
  machineCtx.paused = false;

  // Update UI
  status.skipped(uniqueAgentId);

  // Reset queue and UI state to prevent leaking to next step
  ctx.indexManager.resetQueue();
  ctx.emitter.setInputState(null);

  // Mark step completed
  await ctx.indexManager.stepCompleted(stepIndex);

  // Transition FSM
  ctx.machine.send({ type: 'SKIP' });

  return { type: 'advance' };
}
