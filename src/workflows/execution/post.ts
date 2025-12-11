import { markStepCompleted, removeFromNotCompleted } from '../../shared/workflows/index.js';
import { handleLoopLogic, createActiveLoop } from '../behaviors/loop/controller.js';
import { handleTriggerLogic } from '../behaviors/trigger/controller.js';
import { handleCheckpointLogic } from '../behaviors/checkpoint/controller.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import { type ModuleStep, type WorkflowTemplate, isModuleStep } from '../templates/types.js';
import { executeTriggerAgent } from './trigger.js';
import type { ActiveLoop } from '../behaviors/skip.js';

interface HandlePostExecOptions {
  step: ModuleStep;
  stepOutput: { output: string };
  cwd: string;
  cmRoot: string;
  index: number;
  emitter: WorkflowEventEmitter;
  uniqueAgentId: string;
  abortController: AbortController;
  template: WorkflowTemplate;
  loopCounters: Map<string, number>;
  activeLoop: ActiveLoop | null;
  engineType: string;
}

interface HandlePostExecResult {
  shouldBreak: boolean;
  newIndex?: number;
  newActiveLoop?: ActiveLoop | null;
  stoppedByCheckpointQuit?: boolean;
  workflowShouldStop?: boolean;
}

/**
 * Handle post-execution behaviors: trigger → checkpoint → loop
 */
export async function handlePostExec(options: HandlePostExecOptions): Promise<HandlePostExecResult> {
  const {
    step,
    stepOutput,
    cwd,
    cmRoot,
    index,
    emitter,
    uniqueAgentId,
    abortController,
    template,
    loopCounters,
    activeLoop,
    engineType,
  } = options;

  // Check for trigger behavior first
  const triggerResult = await handleTriggerLogic(step, stepOutput.output, cwd, emitter);
  if (triggerResult?.shouldTrigger && triggerResult.triggerAgentId) {
    const triggeredAgentId = triggerResult.triggerAgentId; // Capture for use in callbacks
    try {
      await executeTriggerAgent({
        triggerAgentId: triggeredAgentId,
        cwd,
        engineType,
        logger: () => {}, // No-op: UI reads from log files
        stderrLogger: () => {}, // No-op: UI reads from log files
        sourceAgentId: uniqueAgentId,
        emitter,
        abortSignal: abortController.signal,
      });
    } catch (triggerError) {
      // Check if this was a user-requested skip (abort)
      if (triggerError instanceof Error && triggerError.name === 'AbortError') {
        emitter.updateAgentStatus(triggeredAgentId, 'skipped');
        emitter.logMessage(triggeredAgentId, `Triggered agent was skipped by user.`);
      }
      // Continue with workflow even if triggered agent fails or is skipped
    }
  }

  // Remove from notCompletedSteps immediately after successful execution
  // This must happen BEFORE loop logic to ensure cleanup even when loops trigger
  await removeFromNotCompleted(cmRoot, index);

  // Mark step as completed if executeOnce is true
  if (step.executeOnce) {
    await markStepCompleted(cmRoot, index);
  }

  // Update UI status to completed
  // This must happen BEFORE loop logic to ensure UI updates even when loops trigger
  emitter.updateAgentStatus(uniqueAgentId, 'completed');

  // Log completion messages BEFORE loop check (so they're part of current agent's output)
  emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
  emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');

  // Check for checkpoint behavior first (to pause workflow for manual review)
  const checkpointResult = await handleCheckpointLogic(step, stepOutput.output, cwd, emitter);
  if (checkpointResult?.shouldStopWorkflow) {
    // Wait for user action via events (Continue or Quit)
    const checkpointAction = await new Promise<'continue' | 'quit'>((resolve) => {
      const continueHandler = () => {
        cleanup();
        resolve('continue');
      };
      const quitHandler = () => {
        cleanup();
        resolve('quit');
      };
      const cleanup = () => {
        process.removeListener('checkpoint:continue', continueHandler);
        process.removeListener('checkpoint:quit', quitHandler);
      };

      process.once('checkpoint:continue', continueHandler);
      process.once('checkpoint:quit', quitHandler);
    });

    // Clear checkpoint state and resume
    emitter.clearCheckpointState();

    if (checkpointAction === 'quit') {
      // User chose to quit from checkpoint - set status to stopped
      emitter.setWorkflowStatus('stopped');
      return { shouldBreak: true, stoppedByCheckpointQuit: true, workflowShouldStop: true };
    }
    // Otherwise continue to next step (current step already marked complete via executeOnce)
  }

  const loopResult = await handleLoopLogic(step, index, stepOutput.output, loopCounters, cwd, emitter);

  if (loopResult.decision?.shouldRepeat) {
    // Set active loop with skip list
    const newActiveLoop = createActiveLoop(loopResult.decision);

    // Update UI loop state
    const loopKey = `${step.module?.id ?? step.agentId}:${index}`;
    const iteration = (loopCounters.get(loopKey) || 0) + 1;
    const loopState = {
      active: true,
      sourceAgent: uniqueAgentId,
      backSteps: loopResult.decision.stepsBack,
      iteration,
      maxIterations: step.module?.behavior?.type === 'loop' ? step.module.behavior.maxIterations ?? Infinity : Infinity,
      skipList: loopResult.decision.skipList || [],
      reason: loopResult.decision.reason,
    };
    emitter.setLoopState(loopState);

    // Reset all agents that will be re-executed in the loop
    // Clear their UI data (telemetry, tool counts, subagents) and monitoring registry data
    // Save their current state to execution history with cycle number
    for (let resetIndex = loopResult.newIndex; resetIndex <= index; resetIndex += 1) {
      const resetStep = template.steps[resetIndex];
      if (resetStep && isModuleStep(resetStep)) {
        const resetUniqueAgentId = `${resetStep.agentId}-step-${resetIndex}`;
        emitter.resetAgentForLoop(resetUniqueAgentId, iteration);
      }
    }

    return {
      shouldBreak: false,
      newIndex: loopResult.newIndex,
      newActiveLoop,
    };
  }

  // Clear active loop only when a loop step explicitly terminates
  const newActiveLoop = createActiveLoop(loopResult.decision);
  if (newActiveLoop !== (undefined as unknown as ActiveLoop | null)) {
    if (!newActiveLoop) {
      emitter.setLoopState(null);
      emitter.clearLoopRound(uniqueAgentId);
    }
    return { shouldBreak: false, newActiveLoop };
  }

  return { shouldBreak: false, newActiveLoop: activeLoop };
}
