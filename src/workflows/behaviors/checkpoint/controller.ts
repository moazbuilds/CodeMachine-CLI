import type { WorkflowStep } from '../../templates/index.js';
import { isModuleStep } from '../../templates/types.js';
import { evaluateCheckpointBehavior } from './evaluator.js';
import { formatAgentLog } from '../../../shared/logging/index.js';
import type { WorkflowUIManager } from '../../../ui/index.js';
import type { WorkflowEventEmitter } from '../../events/emitter.js';

export interface CheckpointDecision {
  shouldStopWorkflow: boolean;
  reason?: string;
}

export async function handleCheckpointLogic(
  step: WorkflowStep,
  output: string,
  cwd: string,
  ui?: WorkflowUIManager,
  emitter?: WorkflowEventEmitter,
): Promise<CheckpointDecision | null> {
  // Only module steps can have checkpoint behavior
  if (!isModuleStep(step)) {
    return null;
  }

  const checkpointDecision = await evaluateCheckpointBehavior({
    behavior: step.module?.behavior,
    output,
    cwd,
  });

  if (checkpointDecision?.shouldStopWorkflow) {
    const message = `${step.agentName} triggered a checkpoint` +
      `${checkpointDecision.reason ? `: ${checkpointDecision.reason}` : ''}.`;

    if (ui) {
      ui.logMessage(step.agentId, message);
      // Set checkpoint state for UI modal
      ui.setCheckpointState({
        active: true,
        reason: checkpointDecision.reason,
      });
    }
    // Emit to event bus for new TUI
    emitter?.logMessage(step.agentId, message);
    emitter?.setCheckpointState({
      active: true,
      reason: checkpointDecision.reason,
    });
    if (!ui && !emitter) {
      console.log(formatAgentLog(step.agentId, message));
    }

    return {
      shouldStopWorkflow: true,
      reason: checkpointDecision.reason,
    };
  }

  return null;
}
