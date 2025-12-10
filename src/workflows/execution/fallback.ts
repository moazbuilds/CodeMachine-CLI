import type { WorkflowStep } from '../templates/index.js';
import { isModuleStep } from '../templates/types.js';
import { executeStep } from './step.js';
import { mainAgents } from '../utils/config.js';
import type { WorkflowEventEmitter } from '../events/index.js';

export interface FallbackExecutionOptions {
  logger: (message: string) => void;
  stderrLogger: (message: string) => void;
  emitter?: WorkflowEventEmitter;
  abortSignal?: AbortSignal;
}

/**
 * Checks if a fallback should be executed for this step.
 * Returns true if the step is in notCompletedSteps and has a fallback agent defined.
 */
export function shouldExecuteFallback(
  step: WorkflowStep,
  stepIndex: number,
  notCompletedSteps: number[],
): boolean {
  return isModuleStep(step) && notCompletedSteps.includes(stepIndex) && !!step.notCompletedFallback;
}

/**
 * Executes the fallback agent for a step that previously failed.
 * The fallback agent uses the same configuration (model, engine, etc.) as the original step.
 */
export async function executeFallbackStep(
  step: WorkflowStep,
  cwd: string,
  workflowStartTime: number,
  engineType: string,
  emitter?: WorkflowEventEmitter,
  uniqueParentAgentId?: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  // Only module steps can have fallback agents
  if (!isModuleStep(step)) {
    throw new Error('Only module steps can have fallback agents');
  }

  if (!step.notCompletedFallback) {
    throw new Error('No fallback agent defined for this step');
  }

  const fallbackAgentId = step.notCompletedFallback;
  const parentAgentId = uniqueParentAgentId ?? step.agentId;

  if (emitter) {
    emitter.logMessage(fallbackAgentId, `Fallback agent for ${step.agentName} started to work.`);
  }

  // Look up the fallback agent's configuration to get its prompt path
  const fallbackAgent = mainAgents.find((agent) => agent?.id === fallbackAgentId);
  if (!fallbackAgent) {
    throw new Error(`Fallback agent not found: ${fallbackAgentId}`);
  }

  if (!fallbackAgent.promptPath) {
    throw new Error(`Fallback agent ${fallbackAgentId} is missing a promptPath configuration`);
  }

  // Create a fallback step with the fallback agent's prompt path
  const fallbackStep: WorkflowStep = {
    ...step,
    agentId: fallbackAgentId,
    agentName: fallbackAgent.name || fallbackAgentId,
    promptPath: fallbackAgent.promptPath, // Use the fallback agent's prompt, not the original step's
  };

  // Add fallback agent as sub-agent
  const engineName = engineType; // preserve original engine type, even if unknown
  const fallbackAgentData = {
    id: fallbackAgentId,
    name: fallbackAgent.name || fallbackAgentId,
    engine: engineName,
    status: 'running' as const,
    parentId: parentAgentId,
    startTime: Date.now(),
    telemetry: { tokensIn: 0, tokensOut: 0 },
    toolCount: 0,
    thinkingCount: 0,
  };
  if (emitter) {
    emitter.addSubAgent(parentAgentId, fallbackAgentData);
  }

  try {
    await executeStep(fallbackStep, cwd, {
      logger: () => {},
      stderrLogger: () => {},
      uniqueAgentId: fallbackAgentId,
      abortSignal,
    });

    // Update status on success
    if (emitter) {
      emitter.updateAgentStatus(fallbackAgentId, 'completed');
      emitter.logMessage(fallbackAgentId, `Fallback agent completed successfully.`);
      emitter.logMessage(fallbackAgentId, '═'.repeat(80));
    }
  } catch (error) {
    // Don't update status to failed - let it stay as running/retrying
    const errorMsg = `Fallback agent failed: ${error instanceof Error ? error.message : String(error)}`;
    if (emitter) {
      emitter.logMessage(fallbackAgentId, errorMsg);
    }
    throw error; // Re-throw to prevent original step from running
  }
}
