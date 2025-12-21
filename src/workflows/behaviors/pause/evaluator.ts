/**
 * Pause Behavior Evaluator
 *
 * Evaluates whether a pause should occur based on:
 * - User keypress (pauseRequested flag)
 * - Agent writing { action: 'pause' } to behavior.json
 */

import { readBehaviorFile } from '../reader.js';
import type { PauseDecision, PauseEvaluationOptions } from './types.js';

/**
 * Evaluate if pause behavior should trigger
 */
export async function evaluatePauseBehavior(
  options: PauseEvaluationOptions
): Promise<PauseDecision | null> {
  const { cwd, pauseRequested } = options;

  // Check user keypress first (higher priority)
  if (pauseRequested) {
    return { shouldPause: true, source: 'user' };
  }

  // Check agent-written behavior.json
  const behaviorAction = await readBehaviorFile(cwd);
  if (behaviorAction?.action === 'pause') {
    return {
      shouldPause: true,
      reason: behaviorAction.reason,
      source: 'agent',
    };
  }

  return null;
}
