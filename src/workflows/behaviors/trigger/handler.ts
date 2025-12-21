import type { WorkflowStep } from '../../templates/index.js';
import { isModuleStep } from '../../templates/types.js';
import { evaluateTriggerBehavior } from './evaluator.js';
import { formatAgentLog } from '../../../shared/logging/index.js';
import type { WorkflowEventEmitter } from '../../events/emitter.js';

export interface TriggerDecision {
  shouldTrigger: boolean;
  triggerAgentId?: string;
  reason?: string;
}

export async function handleTriggerLogic(
  step: WorkflowStep,
  output: string,
  cwd: string,
  emitter?: WorkflowEventEmitter,
): Promise<TriggerDecision | null> {
  // Only module steps can have trigger behavior
  if (!isModuleStep(step)) {
    return null;
  }

  const triggerDecision = await evaluateTriggerBehavior({
    behavior: step.module?.behavior,
    output,
    cwd,
  });

  if (process.env.CODEMACHINE_DEBUG_TRIGGERS === '1') {
    const tail = output.trim().split(/\n/).slice(-1)[0] ?? '';
    const debugMsg = `[trigger] step=${step.agentName} behavior=${JSON.stringify(step.module?.behavior)} lastLine=${tail}`;
    emitter?.logMessage(step.agentId, debugMsg);
    if (!emitter) {
      console.log(formatAgentLog(step.agentId, debugMsg));
    }
  }

  if (triggerDecision?.shouldTrigger && triggerDecision.triggerAgentId) {
    const message = `${step.agentName} is triggering agent '${triggerDecision.triggerAgentId}'${triggerDecision.reason ? ` (${triggerDecision.reason})` : ''}.`;
    emitter?.logMessage(step.agentId, message);
    if (!emitter) {
      console.log(formatAgentLog(step.agentId, message));
    }

    return {
      shouldTrigger: true,
      triggerAgentId: triggerDecision.triggerAgentId,
      reason: triggerDecision.reason,
    };
  }

  if (triggerDecision?.reason) {
    const skipMsg = `${step.agentName} trigger skipped: ${triggerDecision.reason}.`;
    emitter?.logMessage(step.agentId, skipMsg);
    if (!emitter) {
      console.log(formatAgentLog(step.agentId, skipMsg));
    }
  }

  return null;
}
