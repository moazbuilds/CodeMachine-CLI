import type { WorkflowStep } from '../templates/index.js';
import { isModuleStep } from '../templates/types.js';
import type { WorkflowUIManager } from '../../ui/index.js';
import type { WorkflowEventEmitter } from '../events/emitter.js';
import { debug } from '../../shared/logging/logger.js';

export interface ActiveLoop {
  skip: string[];
}

export function shouldSkipStep(
  step: WorkflowStep,
  index: number,
  completedSteps: number[],
  activeLoop: ActiveLoop | null,
  ui?: WorkflowUIManager,
  uniqueAgentId?: string,
  emitter?: WorkflowEventEmitter,
  selectedTrack?: string | null,
): { skip: boolean; reason?: string } {
  // UI steps can't be skipped
  if (!isModuleStep(step)) {
    return { skip: false };
  }

  // Use provided unique agent ID or fall back to step.agentId
  const agentId = uniqueAgentId ?? step.agentId;

  // Track-based filtering: skip if step has tracks and selectedTrack not in list
  if (step.tracks?.length && selectedTrack && !step.tracks.includes(selectedTrack)) {
    ui?.updateAgentStatus(agentId, 'skipped');
    emitter?.updateAgentStatus(agentId, 'skipped');
    return { skip: true, reason: `${step.agentName} skipped (not in "${selectedTrack}" track).` };
  }

  // Skip step if executeOnce is true and it's already completed
  if (step.executeOnce && completedSteps.includes(index)) {
    ui?.updateAgentStatus(agentId, 'skipped');
    emitter?.updateAgentStatus(agentId, 'skipped');
    return { skip: true, reason: `${step.agentName} skipped (already completed).` };
  }

  // Skip step if it's in the active loop's skip list
  if (activeLoop?.skip.includes(step.agentId)) {
    ui?.updateAgentStatus(agentId, 'skipped');
    emitter?.updateAgentStatus(agentId, 'skipped');
    return { skip: true, reason: `${step.agentName} skipped (loop configuration).` };
  }

  return { skip: false };
}

export function logSkipDebug(step: WorkflowStep, activeLoop: ActiveLoop | null): void {
  if (!isModuleStep(step)) {
    return;
  }

  if (activeLoop) {
    debug(
      `[skip-check] agentId=${step.agentId} skipList=[${activeLoop.skip.join(', ')}] shouldSkip=${activeLoop.skip.includes(step.agentId)}`
    );
  }
}
