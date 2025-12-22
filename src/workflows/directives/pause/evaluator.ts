/**
 * Pause Directive Evaluator
 *
 * Evaluates whether a pause should occur based on:
 * - User keypress (pauseRequested flag)
 * - Agent writing { action: 'pause' } to directive.json
 */

import { readDirectiveFile } from '../reader.js';
import type { PauseDecision, PauseEvaluationOptions } from './types.js';

/**
 * Evaluate if pause directive should trigger
 */
export async function evaluatePauseDirective(
  options: PauseEvaluationOptions
): Promise<PauseDecision | null> {
  const { cwd, pauseRequested } = options;

  // Check user keypress first (higher priority)
  if (pauseRequested) {
    return { shouldPause: true, source: 'user' };
  }

  // Check agent-written directive.json
  const directiveAction = await readDirectiveFile(cwd);
  if (directiveAction?.action === 'pause') {
    return {
      shouldPause: true,
      reason: directiveAction.reason,
      source: 'agent',
    };
  }

  return null;
}
