import type { WorkflowStep } from '../../templates/index.js';
import { isModuleStep } from '../../templates/types.js';
import { evaluateLoopBehavior } from './evaluator.js';
import { formatAgentLog } from '../../../shared/logging/index.js';
import type { ActiveLoop } from '../skip.js';
import type { WorkflowUIManager } from '../../../ui/index.js';
import type { WorkflowEventEmitter } from '../../events/emitter.js';
import { debug } from '../../../shared/logging/logger.js';

export interface LoopDecision {
  shouldRepeat: boolean;
  stepsBack: number;
  skipList: string[];
  reason?: string;
}

export async function handleLoopLogic(
  step: WorkflowStep,
  index: number,
  output: string,
  loopCounters: Map<string, number>,
  cwd: string,
  ui?: WorkflowUIManager,
  emitter?: WorkflowEventEmitter,
): Promise<{ decision: LoopDecision | null; newIndex: number }> {
  // Only module steps can have loop behavior
  if (!isModuleStep(step)) {
    return { decision: null, newIndex: index };
  }

  const loopKey = `${step.module?.id ?? step.agentId}:${index}`;
  const iterationCount = loopCounters.get(loopKey) ?? 0;
  const loopDecision = await evaluateLoopBehavior({
    behavior: step.module?.behavior,
    output,
    iterationCount,
    cwd,
  });

  const tail = output.trim().split(/\n/).slice(-1)[0] ?? '';
  debug(
    `[loop] step=${step.agentName} behavior=${JSON.stringify(step.module?.behavior)} ` +
      `iteration=${iterationCount} lastLine=${tail}`
  );

  if (loopDecision?.shouldRepeat) {
    const nextIterationCount = iterationCount + 1;
    loopCounters.set(loopKey, nextIterationCount);
    const stepsBack = Math.max(1, loopDecision.stepsBack);
    const rewindIndex = Math.max(-1, index - stepsBack - 1);

    const skipList = step.module?.behavior?.type === 'loop' ? step.module.behavior.skip ?? [] : [];
    const skipInfo = skipList.length > 0 ? ` (skipping: ${skipList.join(', ')})` : '';

    const maxIter = step.module?.behavior?.type === 'loop' ? step.module.behavior.maxIterations : undefined;
    const message = `${step.agentName} triggered a loop` +
      `${loopDecision.reason ? ` (${loopDecision.reason})` : ''}; ` +
      `repeating previous step. Iteration ${nextIterationCount}${maxIter ? `/${maxIter}` : ''}${skipInfo}.`;

    if (ui) {
      ui.logMessage(step.agentId, message);
    }
    emitter?.logMessage(step.agentId, message);
    if (!ui && !emitter) {
      console.log(formatAgentLog(step.agentId, message));
    }

    return {
      decision: { shouldRepeat: true, stepsBack, skipList, reason: loopDecision.reason },
      newIndex: rewindIndex,
    };
  }

  if (loopDecision?.reason) {
    const skipMsg = `${step.agentName} loop skipped: ${loopDecision.reason}.`;
    if (ui) {
      ui.logMessage(step.agentId, skipMsg);
    }
    emitter?.logMessage(step.agentId, skipMsg);
    if (!ui && !emitter) {
      console.log(formatAgentLog(step.agentId, skipMsg));
    }
  }

  // Clear loop counter when loop terminates
  if (loopDecision !== null && !loopDecision.shouldRepeat) {
    loopCounters.set(loopKey, 0);
  }

  return { decision: null, newIndex: index };
}

export function createActiveLoop(decision: LoopDecision | null): ActiveLoop | null {
  if (decision?.shouldRepeat) {
    return { skip: decision.skipList };
  }
  // Clear active loop only when a loop step explicitly terminates (shouldRepeat=false)
  if (decision !== null && !decision.shouldRepeat) {
    return null;
  }
  // Return undefined to indicate no change to activeLoop
  return undefined as unknown as ActiveLoop | null;
}
