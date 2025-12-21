import type { ModuleBehavior } from '../../templates/index.js';
import { readBehaviorFile } from '../reader.js';

export interface LoopEvaluationOptions {
  behavior?: ModuleBehavior;
  output: string;
  iterationCount: number;
  cwd: string;
}

export interface LoopEvaluationResult {
  shouldRepeat: boolean;
  stepsBack: number;
  reason?: string;
}

export async function evaluateLoopBehavior(options: LoopEvaluationOptions): Promise<LoopEvaluationResult | null> {
  const { behavior, iterationCount, cwd } = options;

  if (!behavior || behavior.type !== 'loop' || behavior.action !== 'stepBack') {
    return null;
  }

  const behaviorAction = await readBehaviorFile(cwd);
  if (!behaviorAction) {
    return null;
  }

  // Check if max iterations reached
  const maxIterations =
    typeof behavior.maxIterations === 'number' && behavior.maxIterations > 0
      ? Math.floor(behavior.maxIterations)
      : undefined;

  if (maxIterations !== undefined && iterationCount + 1 > maxIterations) {
    return {
      shouldRepeat: false,
      stepsBack: behavior.steps,
      reason: `loop limit reached (${maxIterations})`,
    };
  }

  // Handle behavior action
  if (behaviorAction.action === 'loop') {
    return {
      shouldRepeat: true,
      stepsBack: behavior.steps,
      reason: behaviorAction.reason,
    };
  }

  if (behaviorAction.action === 'stop') {
    return {
      shouldRepeat: false,
      stepsBack: behavior.steps,
      reason: behaviorAction.reason,
    };
  }

  // 'continue', 'checkpoint', 'trigger', or unknown action = no special behavior
  return null;
}
