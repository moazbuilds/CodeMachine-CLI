/**
 * Pause Directive Handler
 *
 * Handles agent-written { action: 'pause' } directive.
 * Similar pattern to checkpoint/handler.ts.
 */

import type { WorkflowStep } from '../../templates/index.js';
import { isModuleStep } from '../../templates/types.js';
import { evaluatePauseDirective } from './evaluator.js';
import type { WorkflowEventEmitter } from '../../events/emitter.js';

export interface PauseHandlerDecision {
  shouldPause: boolean;
  reason?: string;
}

export async function handlePauseLogic(
  step: WorkflowStep,
  cwd: string,
  emitter?: WorkflowEventEmitter,
): Promise<PauseHandlerDecision | null> {
  // Only module steps can have pause behavior
  if (!isModuleStep(step)) {
    return null;
  }

  const pauseDecision = await evaluatePauseDirective({
    cwd,
    pauseRequested: false, // Only check agent-written directive, not user keypress
  });

  if (pauseDecision?.shouldPause) {
    const message = `${step.agentName} requested pause` +
      `${pauseDecision.reason ? `: ${pauseDecision.reason}` : ''}`;

    emitter?.logMessage(step.agentId, message);

    return {
      shouldPause: true,
      reason: pauseDecision.reason,
    };
  }

  return null;
}
