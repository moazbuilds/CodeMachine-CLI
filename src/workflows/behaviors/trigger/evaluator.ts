import type { ModuleBehavior } from '../../templates/index.js';
import { readBehaviorFile } from '../reader.js';

export interface TriggerEvaluationOptions {
  behavior?: ModuleBehavior;
  output: string;
  cwd: string;
}

export interface TriggerEvaluationResult {
  shouldTrigger: boolean;
  triggerAgentId?: string;
  reason?: string;
}

export async function evaluateTriggerBehavior(options: TriggerEvaluationOptions): Promise<TriggerEvaluationResult | null> {
  const { behavior, cwd } = options;

  if (!behavior || behavior.type !== 'trigger' || behavior.action !== 'mainAgentCall') {
    return null;
  }

  const behaviorAction = await readBehaviorFile(cwd);
  if (!behaviorAction) {
    return null;
  }

  // Handle trigger action
  if (behaviorAction.action === 'trigger') {
    const targetAgentId = behaviorAction.triggerAgentId || behavior.triggerAgentId;

    if (!targetAgentId) {
      console.error('Trigger action requires triggerAgentId in behavior.json or module configuration');
      return null;
    }

    return {
      shouldTrigger: true,
      triggerAgentId: targetAgentId,
      reason: behaviorAction.reason,
    };
  }

  // 'continue', 'loop', 'checkpoint', or unknown action = no trigger behavior
  return null;
}
