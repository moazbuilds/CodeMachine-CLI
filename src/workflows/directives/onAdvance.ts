/**
 * On Advance Directive Evaluation
 *
 * Single function that reads directive.json and returns the action
 * to take when user presses Enter (empty input) to advance.
 */

import { readDirectiveFile } from './reader.js';

export type AdvanceAction =
  | { type: 'advance' }
  | { type: 'loop'; reason?: string }
  | { type: 'stop'; reason?: string }
  | { type: 'error'; reason?: string }
  | { type: 'checkpoint'; reason?: string }
  | { type: 'pause'; reason?: string }
  | { type: 'trigger'; agentId: string; reason?: string };

/**
 * Evaluate directive.json to determine action on advance (Enter press)
 *
 * Reads directive once and returns appropriate action for all directive types.
 */
export async function evaluateOnAdvance(cwd: string): Promise<AdvanceAction> {
  const directive = await readDirectiveFile(cwd);

  if (!directive || directive.action === 'continue') {
    return { type: 'advance' };
  }

  switch (directive.action) {
    case 'loop':
      return { type: 'loop', reason: directive.reason };
    case 'stop':
      return { type: 'stop', reason: directive.reason };
    case 'error':
      return { type: 'error', reason: directive.reason };
    case 'checkpoint':
      return { type: 'checkpoint', reason: directive.reason };
    case 'pause':
      return { type: 'pause', reason: directive.reason };
    case 'trigger':
      return directive.triggerAgentId
        ? { type: 'trigger', agentId: directive.triggerAgentId, reason: directive.reason }
        : { type: 'advance' };
    default:
      return { type: 'advance' };
  }
}
