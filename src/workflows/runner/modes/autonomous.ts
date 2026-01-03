/**
 * Autonomous Mode Handler
 *
 * Handles scenario 5: fully autonomous prompt loop.
 * Extracted from runAutonomousPromptLoop() in wait.ts and delegated.ts.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { ModeHandler, ModeHandlerContext, ModeHandlerResult } from './types.js';
import {
  processDirectives,
  checkPauseDirective,
  sendQueuedPrompt,
} from '../actions/index.js';
import { getUniqueAgentId } from '../../context/index.js';
import { StatusService } from '../../../agents/monitoring/index.js';

/**
 * Check if queue is exhausted
 */
function isQueueExhausted(ctx: ModeHandlerContext['ctx']): boolean {
  const session = ctx.getCurrentSession();
  return session ? session.isQueueExhausted : ctx.indexManager.isQueueExhausted();
}

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
 * Emit pause input state
 */
function emitPauseInputState(ctx: ModeHandlerContext['ctx']): void {
  const machineCtx = ctx.machine.context;
  const queueState = getQueueState(ctx);

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

  debug('[modes/autonomous] Pausing workflow');
  ctx.mode.pause();
  machineCtx.paused = true;
  const status = StatusService.getInstance();
  status.awaiting(uniqueAgentId);
  emitPauseInputState(ctx);

  return { type: 'pause', reason };
}

/**
 * Autonomous mode handler
 *
 * Automatically sends the next chained prompt without user involvement.
 * Each prompt runs through the state machine naturally - when it completes,
 * this handler is called again to send the next prompt.
 */
export const autonomousHandler: ModeHandler = {
  id: 'autonomous',
  name: 'Autonomous Mode',
  scenarios: [5],

  async handle(context: ModeHandlerContext): Promise<ModeHandlerResult> {
    const { ctx, scenario, callbacks } = context;
    const machineCtx = ctx.machine.context;
    const stepIndex = machineCtx.currentStepIndex;
    const step = ctx.moduleSteps[stepIndex];
    const uniqueAgentId = getUniqueAgentId(step, stepIndex);

    debug(
      '[modes/autonomous] Handling scenario %d (%s), queueLen=%d, queueIndex=%d',
      scenario.id,
      scenario.name,
      ctx.indexManager.promptQueue.length,
      ctx.indexManager.promptQueueIndex
    );

    // Check for pause directive BEFORE sending next prompt
    const pauseResult = await checkPauseDirective(ctx);
    if (pauseResult) {
      return handlePause(ctx, pauseResult.reason);
    }

    // Check if queue is exhausted
    if (isQueueExhausted(ctx)) {
      debug('[modes/autonomous] Queue exhausted, processing directives');

      const action = await processDirectives(ctx);

      switch (action.type) {
        case 'stop':
          ctx.machine.send({ type: 'STOP' });
          return { type: 'stop' };

        case 'checkpoint':
          return { type: 'checkpoint' };

        case 'pause':
          return handlePause(ctx, action.reason);

        case 'loop': {
          debug('[modes/autonomous] Loop to step %d', action.targetIndex);
          const status = StatusService.getInstance();
          status.completed(uniqueAgentId);
          await ctx.indexManager.stepCompleted(stepIndex);
          ctx.indexManager.resetQueue();
          ctx.emitter.setInputState(null);
          machineCtx.currentStepIndex = action.targetIndex;
          ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
          return action;
        }

        case 'advance':
        default: {
          debug('[modes/autonomous] Completing step %d', stepIndex);
          const status = StatusService.getInstance();
          status.completed(uniqueAgentId);
          ctx.indexManager.resetQueue();
          ctx.emitter.setInputState(null);
          await ctx.indexManager.stepCompleted(stepIndex);
          ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
          return { type: 'advance' };
        }
      }
    }

    // Get next prompt
    const nextPrompt = ctx.indexManager.getCurrentQueuedPrompt();
    if (!nextPrompt) {
      // Fallback: queue not marked exhausted but no prompt available
      debug('[modes/autonomous] No prompt available, processing directives');

      const action = await processDirectives(ctx);

      switch (action.type) {
        case 'stop':
          ctx.machine.send({ type: 'STOP' });
          return { type: 'stop' };

        case 'checkpoint':
          return { type: 'checkpoint' };

        case 'pause':
          return handlePause(ctx, action.reason);

        case 'loop': {
          debug('[modes/autonomous] Loop to step %d', action.targetIndex);
          const status = StatusService.getInstance();
          status.completed(uniqueAgentId);
          await ctx.indexManager.stepCompleted(stepIndex);
          ctx.indexManager.resetQueue();
          ctx.emitter.setInputState(null);
          machineCtx.currentStepIndex = action.targetIndex;
          ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
          return action;
        }

        case 'advance':
        default: {
          debug('[modes/autonomous] Completing step %d', stepIndex);
          const status = StatusService.getInstance();
          status.completed(uniqueAgentId);
          ctx.indexManager.resetQueue();
          ctx.emitter.setInputState(null);
          await ctx.indexManager.stepCompleted(stepIndex);
          ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
          return { type: 'advance' };
        }
      }
    }

    // Send the next prompt
    debug(
      '[modes/autonomous] Sending prompt %d: %s...',
      ctx.indexManager.promptQueueIndex,
      nextPrompt.content.slice(0, 50)
    );

    return sendQueuedPrompt(ctx, callbacks);
  },
};
