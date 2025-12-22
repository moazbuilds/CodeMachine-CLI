import type { ModuleBehavior } from '../../templates/index.js';
import { readDirectiveFile } from '../reader.js';

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

export async function evaluateTriggerDirective(options: TriggerEvaluationOptions): Promise<TriggerEvaluationResult | null> {
  const { behavior, cwd } = options;

  if (!behavior || behavior.type !== 'trigger' || behavior.action !== 'mainAgentCall') {
    return null;
  }

  const directiveAction = await readDirectiveFile(cwd);
  if (!directiveAction) {
    return null;
  }

  // Handle trigger action
  if (directiveAction.action === 'trigger') {
    const targetAgentId = directiveAction.triggerAgentId || behavior.triggerAgentId;

    if (!targetAgentId) {
      console.error('Trigger action requires triggerAgentId in directive.json or module configuration');
      return null;
    }

    return {
      shouldTrigger: true,
      triggerAgentId: targetAgentId,
      reason: directiveAction.reason,
    };
  }

  // 'continue', 'loop', 'checkpoint', or unknown action = no trigger behavior
  return null;
}
