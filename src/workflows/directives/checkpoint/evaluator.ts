import type { ModuleBehavior } from '../../templates/index.js';
import { readDirectiveFile } from '../reader.js';

export interface CheckpointEvaluationOptions {
  behavior?: ModuleBehavior;
  output: string;
  cwd: string;
}

export interface CheckpointEvaluationResult {
  shouldStopWorkflow: boolean;
  reason?: string;
}

export async function evaluateCheckpointDirective(options: CheckpointEvaluationOptions): Promise<CheckpointEvaluationResult | null> {
  const { cwd } = options;

  // Checkpoint is universal - any agent can write checkpoint to directive.json
  const directiveAction = await readDirectiveFile(cwd);
  if (!directiveAction) {
    return null;
  }

  // Handle checkpoint action
  if (directiveAction.action === 'checkpoint') {
    return {
      shouldStopWorkflow: true,
      reason: directiveAction.reason,
    };
  }

  // 'continue', 'loop', 'trigger', or unknown action = no checkpoint behavior
  return null;
}
