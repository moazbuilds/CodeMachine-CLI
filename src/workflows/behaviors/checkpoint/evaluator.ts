import type { ModuleBehavior } from '../../templates/index.js';
import { readBehaviorFile } from '../reader.js';

export interface CheckpointEvaluationOptions {
  behavior?: ModuleBehavior;
  output: string;
  cwd: string;
}

export interface CheckpointEvaluationResult {
  shouldStopWorkflow: boolean;
  reason?: string;
}

export async function evaluateCheckpointBehavior(options: CheckpointEvaluationOptions): Promise<CheckpointEvaluationResult | null> {
  const { cwd } = options;

  // Checkpoint is universal - any agent can write checkpoint to behavior.json
  const behaviorAction = await readBehaviorFile(cwd);
  if (!behaviorAction) {
    return null;
  }

  // Handle checkpoint action
  if (behaviorAction.action === 'checkpoint') {
    return {
      shouldStopWorkflow: true,
      reason: behaviorAction.reason,
    };
  }

  // 'continue', 'loop', 'trigger', or unknown action = no checkpoint behavior
  return null;
}
