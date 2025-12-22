import type { ModuleBehavior } from '../../templates/index.js';
import { readDirectiveFile } from '../reader.js';

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

export async function evaluateLoopDirective(options: LoopEvaluationOptions): Promise<LoopEvaluationResult | null> {
  const { behavior, iterationCount, cwd } = options;

  if (!behavior || behavior.type !== 'loop' || behavior.action !== 'stepBack') {
    return null;
  }

  const directiveAction = await readDirectiveFile(cwd);
  if (!directiveAction) {
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

  // Handle directive action
  if (directiveAction.action === 'loop') {
    return {
      shouldRepeat: true,
      stepsBack: behavior.steps,
      reason: directiveAction.reason,
    };
  }

  if (directiveAction.action === 'stop') {
    return {
      shouldRepeat: false,
      stepsBack: behavior.steps,
      reason: directiveAction.reason,
    };
  }

  // 'continue', 'checkpoint', 'trigger', or unknown action = no special behavior
  return null;
}
