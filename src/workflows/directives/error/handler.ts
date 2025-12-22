import type { WorkflowStep } from '../../templates/index.js';
import { isModuleStep } from '../../templates/types.js';
import { evaluateErrorDirective } from './evaluator.js';
import { formatAgentLog } from '../../../shared/logging/index.js';
import type { WorkflowEventEmitter } from '../../events/emitter.js';

export interface ErrorDecision {
  shouldStopWorkflow: boolean;
  reason?: string;
}

export async function handleErrorLogic(
  step: WorkflowStep,
  output: string,
  cwd: string,
  emitter?: WorkflowEventEmitter,
): Promise<ErrorDecision | null> {
  // Only module steps can have error behavior
  if (!isModuleStep(step)) {
    return null;
  }

  const errorDecision = await evaluateErrorDirective({
    output,
    cwd,
  });

  if (errorDecision?.shouldStopWorkflow) {
    const message = `${step.agentName} reported an error` +
      `${errorDecision.reason ? `: ${errorDecision.reason}` : ''}.`;

    emitter?.logMessage(step.agentId, message);
    if (!emitter) {
      console.log(formatAgentLog(step.agentId, message));
    }

    return {
      shouldStopWorkflow: true,
      reason: errorDecision.reason,
    };
  }

  return null;
}
