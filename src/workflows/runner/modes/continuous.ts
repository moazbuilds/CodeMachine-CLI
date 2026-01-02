/**
 * Continuous Mode Handler
 *
 * Handles scenario 6: auto-advance to next step.
 * Used when interactive:false + autoMode + no chainedPrompts.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { ModeHandler, ModeHandlerContext, ModeHandlerResult } from './types.js';
import { processDirectives, advanceToNextStep } from '../actions/index.js';
import { getUniqueAgentId } from '../../context/index.js';

/**
 * Get queue state for UI emission
 */
function getQueueState(ctx: ModeHandlerContext['ctx']) {
  const session = ctx.getCurrentSession();
  return session
    ? session.getQueueState()
    : {
        promptQueue: [...ctx.indexManager.promptQueue],
        promptQueueIndex: ctx.indexManager.promptQueueIndex,
      };
}

/**
 * Handle pause result
 */
function handlePause(
  ctx: ModeHandlerContext['ctx'],
  reason?: string
): ModeHandlerResult {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);
  const queueState = getQueueState(ctx);

  debug('[modes/continuous] Pausing workflow');
  ctx.emitter.logMessage(uniqueAgentId, `Paused${reason ? `: ${reason}` : ''}`);
  ctx.mode.pause();
  machineCtx.paused = true;
  ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');

  // Enable input box for user to resume
  ctx.emitter.setInputState({
    active: true,
    queuedPrompts: queueState.promptQueue.map((p) => ({
      name: p.name,
      label: p.label,
      content: p.content,
    })),
    currentIndex: queueState.promptQueueIndex,
    monitoringId: machineCtx.currentMonitoringId,
  });

  return { type: 'pause', reason };
}

/**
 * Continuous mode handler
 *
 * Automatically advances to the next step without waiting for input.
 * Processes directives (loop, pause, etc.) before advancing.
 */
export const continuousHandler: ModeHandler = {
  id: 'continuous',
  name: 'Continuous Mode',
  scenarios: [6],

  async handle(context: ModeHandlerContext): Promise<ModeHandlerResult> {
    const { ctx, scenario } = context;
    const machineCtx = ctx.machine.context;
    const stepIndex = machineCtx.currentStepIndex;
    const step = ctx.moduleSteps[stepIndex];
    const uniqueAgentId = getUniqueAgentId(step, stepIndex);
    const session = ctx.getCurrentSession();

    debug(
      '[modes/continuous] Handling scenario %d (%s)',
      scenario.id,
      scenario.name
    );

    // Process directives - may result in loop, stop, pause, etc.
    const action = await processDirectives(ctx);

    debug('[modes/continuous] Directive action: %s', action.type);

    switch (action.type) {
      case 'stop':
        ctx.machine.send({ type: 'STOP' });
        return { type: 'stop' };

      case 'checkpoint':
        // Checkpoint was handled, stay in current state
        return { type: 'checkpoint' };

      case 'pause':
        return handlePause(ctx, action.reason);

      case 'loop':
        debug('[modes/continuous] Loop to step %d', action.targetIndex);
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
        await ctx.indexManager.stepCompleted(stepIndex);
        ctx.indexManager.resetQueue();
        ctx.emitter.setInputState(null);
        machineCtx.currentStepIndex = action.targetIndex;
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
        return action;

      case 'advance':
      default:
        debug('[modes/continuous] Auto-advancing to next step');
        if (session) {
          await session.complete();
        }
        return advanceToNextStep(ctx);
    }
  },
};
