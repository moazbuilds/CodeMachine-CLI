/**
 * Unified Directive Processing
 *
 * Consolidates directive handling from wait.ts and delegated.ts.
 * Single source of truth for processing directives.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { RunnerContext } from '../types.js';
import type { ModeHandlerResult } from '../modes/types.js';
import { evaluateOnAdvance, type AdvanceAction } from '../../directives/index.js';
import {
  processPostStepDirectives,
  type PostStepAction,
} from '../../step/hooks.js';
import { getUniqueAgentId } from '../../context/index.js';

/**
 * Convert PostStepAction to ModeHandlerResult
 */
export function postStepActionToResult(action: PostStepAction): ModeHandlerResult {
  switch (action.type) {
    case 'stop':
      return { type: 'stop' };
    case 'checkpoint':
      return { type: 'checkpoint' };
    case 'pause':
      return { type: 'pause', reason: action.reason };
    case 'loop':
      return { type: 'loop', targetIndex: action.targetIndex };
    case 'advance':
    default:
      return { type: 'advance' };
  }
}

/**
 * Process post-step directives and return mode handler result
 *
 * Wraps processPostStepDirectives from hooks.ts and converts result.
 */
export async function processDirectives(
  ctx: RunnerContext
): Promise<ModeHandlerResult> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  const action = await processPostStepDirectives({
    ctx,
    step,
    stepOutput: { output: machineCtx.currentOutput?.output ?? '' },
    stepIndex,
    uniqueAgentId,
  });

  debug('[actions/directives] Post-step action: %s', action.type);

  return postStepActionToResult(action);
}

/**
 * Handle advance directive (on Enter press or empty input)
 *
 * Lightweight directive check used when user presses Enter.
 * This handles directives like loop, stop, error, checkpoint, pause, trigger.
 */
export async function handleAdvanceDirective(
  ctx: RunnerContext
): Promise<ModeHandlerResult> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  const advanceAction = await evaluateOnAdvance(ctx.cwd);

  debug('[actions/directives] Advance directive: %s', advanceAction.type);

  switch (advanceAction.type) {
    case 'loop':
      ctx.emitter.logMessage(
        uniqueAgentId,
        `Loop requested${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`
      );
      return { type: 'continue' }; // Stay on current step

    case 'stop':
      ctx.emitter.logMessage(
        uniqueAgentId,
        `Stop requested${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`
      );
      return { type: 'stop' };

    case 'error':
      ctx.emitter.logMessage(
        uniqueAgentId,
        `Error: ${advanceAction.reason ?? 'Unknown error'}`
      );
      ctx.emitter.setWorkflowStatus('error');
      (process as NodeJS.EventEmitter).emit('workflow:error', {
        reason: advanceAction.reason,
      });
      return { type: 'error', reason: advanceAction.reason };

    case 'checkpoint':
      ctx.emitter.logMessage(
        uniqueAgentId,
        `Checkpoint${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`
      );
      ctx.emitter.setCheckpointState({ active: true, reason: advanceAction.reason });
      return { type: 'checkpoint' };

    case 'pause':
      ctx.emitter.logMessage(
        uniqueAgentId,
        `Paused${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`
      );
      return { type: 'pause', reason: advanceAction.reason };

    case 'trigger':
      ctx.emitter.logMessage(
        uniqueAgentId,
        `Triggering ${advanceAction.agentId}${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`
      );
      // TODO: Execute trigger agent
      return { type: 'advance' };

    case 'advance':
    default:
      return { type: 'advance' };
  }
}

/**
 * Pause directive result type
 */
export type PauseDirectiveResult = { type: 'pause'; reason?: string };

/**
 * Check for pause directive before autonomous operations
 *
 * Used by autonomous mode to check if pause was requested before sending prompts.
 */
export async function checkPauseDirective(
  ctx: RunnerContext
): Promise<PauseDirectiveResult | null> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  const advanceAction = await evaluateOnAdvance(ctx.cwd);

  if (advanceAction.type === 'pause') {
    debug('[actions/directives] Pause directive detected');
    ctx.emitter.logMessage(
      uniqueAgentId,
      `Paused${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`
    );
    return { type: 'pause', reason: advanceAction.reason };
  }

  return null;
}
