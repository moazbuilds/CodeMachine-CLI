/**
 * Unified Step Runner
 *
 * Single entry point for running a step, whether fresh or resuming.
 * Eliminates duplication between exec.ts and wait.ts:resumeWithInput()
 */

import { debug } from '../../shared/logging/logger.js';
import { AgentMonitorService } from '../../agents/monitoring/index.js';
import type { StepOutput as StateStepOutput } from '../state/index.js';
import { getUniqueAgentId } from '../context/index.js';
import { executeStep } from './execute.js';
import { selectEngine } from './engine.js';
import { registry } from '../../infra/engines/index.js';
import {
  markStepStarted,
  initStepSession,
  getStepData,
} from '../../shared/workflows/steps.js';
import { beforeRun, afterRun, cleanupRun } from './hooks.js';
import type { RunnerContext } from '../runner/types.js';

/**
 * Options for running a step
 */
export interface RunStepOptions {
  /** Resume prompt (if resuming with user input) */
  resumePrompt?: string;
  /** Resume session ID */
  resumeSessionId?: string;
  /** Resume monitoring ID */
  resumeMonitoringId?: number;
  /** Source of the input */
  source?: 'user' | 'controller';
}

/**
 * Result from running a step
 */
export interface RunStepResult {
  /** Step output */
  output: StateStepOutput;
  /** Whether workflow should stop */
  shouldStop?: boolean;
  /** New step index (for loops) */
  newIndex?: number;
  /** Whether checkpoint was continued */
  checkpointContinued?: boolean;
}

/**
 * Run a step (fresh start)
 *
 * Called when state machine is in "running" state.
 */
export async function runStepFresh(ctx: RunnerContext): Promise<RunStepResult | null> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  debug('[step/run] Running fresh step %d: %s', stepIndex, step.agentName);

  // Check for resume data (existing session from previous run)
  const stepData = await getStepData(ctx.cmRoot, stepIndex);
  const isResuming = stepData?.sessionId && !stepData.completedAt;

  // If resuming from crash, go directly to waiting state
  if (isResuming) {
    debug('[step/run] Found resume data, going to waiting state');

    if (stepData.monitoringId !== undefined) {
      ctx.emitter.registerMonitoringId(uniqueAgentId, stepData.monitoringId);
    }

    ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
    ctx.emitter.logMessage(uniqueAgentId, '═'.repeat(80));
    ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} resumed - waiting for input.`);

    machineCtx.currentMonitoringId = stepData.monitoringId;
    machineCtx.currentOutput = {
      output: '',
      monitoringId: stepData.monitoringId,
    };

    ctx.machine.send({
      type: 'STEP_COMPLETE',
      output: { output: '', monitoringId: stepData.monitoringId },
    });
    return null;
  }

  // Track step start for resume
  await markStepStarted(ctx.cmRoot, stepIndex);

  // Setup (abort controller, UI status, directives)
  const { abortController } = beforeRun({
    ctx,
    stepIndex,
    uniqueAgentId,
    isResume: false,
  });

  // Determine and set engine
  const engineType = await selectEngine(step, ctx.emitter, uniqueAgentId);
  step.engine = engineType;
  ctx.emitter.updateAgentEngine(uniqueAgentId, engineType);

  // Resolve model
  const engineModule = registry.get(engineType);
  const resolvedModel = step.model ?? engineModule?.metadata.defaultModel;
  if (resolvedModel) {
    ctx.emitter.updateAgentModel(uniqueAgentId, resolvedModel);
  }

  try {
    // Execute the step
    const output = await executeStep(step, ctx.cwd, {
      logger: () => {},
      stderrLogger: () => {},
      emitter: ctx.emitter,
      abortSignal: abortController.signal,
      uniqueAgentId,
    });

    debug('[step/run] Step completed');

    // Track session info for resume
    if (output.monitoringId !== undefined) {
      const monitor = AgentMonitorService.getInstance();
      const agentInfo = monitor.getAgent(output.monitoringId);
      const sessionId = agentInfo?.sessionId ?? '';
      await initStepSession(ctx.cmRoot, stepIndex, sessionId, output.monitoringId);
    }

    const stepOutput: StateStepOutput = {
      output: output.output,
      monitoringId: output.monitoringId,
    };

    // Handle post-execution directives
    const postResult = await afterRun({
      step,
      stepOutput: { output: output.output },
      cwd: ctx.cwd,
      cmRoot: ctx.cmRoot,
      index: stepIndex,
      emitter: ctx.emitter,
      uniqueAgentId,
      abortController,
      template: ctx.template,
      loopCounters: ctx.getLoopCounters(),
      activeLoop: ctx.getActiveLoop(),
      engineType: step.engine ?? 'claude-code',
    });

    // Handle directive results
    if (postResult.workflowShouldStop) {
      debug('[step/run] Workflow should stop due to directive');
      ctx.machine.send({ type: 'STOP' });
      return { output: stepOutput, shouldStop: true };
    }

    // Update active loop state
    if (postResult.newActiveLoop !== undefined) {
      ctx.setActiveLoop(postResult.newActiveLoop);
    }

    // Handle loop - rewind to previous step
    if (postResult.newIndex !== undefined) {
      const targetIndex = postResult.newIndex + 1;
      if (targetIndex >= 0 && targetIndex <= stepIndex) {
        debug('[step/run] Loop directive: rewinding to step %d', targetIndex);
        machineCtx.currentStepIndex = targetIndex;
        return { output: stepOutput, newIndex: targetIndex };
      }
    }

    // Checkpoint continued - skip chained prompts
    if (postResult.checkpointContinued) {
      debug('[step/run] Checkpoint continued, advancing to next step');
      ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
      ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} checkpoint completed.`);
      ctx.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
      machineCtx.promptQueue = [];
      machineCtx.promptQueueIndex = 0;
      ctx.machine.send({ type: 'STEP_COMPLETE', output: stepOutput });
      return { output: stepOutput, checkpointContinued: true };
    }

    // Handle chained prompts
    debug('[step/run] chainedPrompts: %d items', output.chainedPrompts?.length ?? 0);
    if (output.chainedPrompts && output.chainedPrompts.length > 0) {
      machineCtx.promptQueue = output.chainedPrompts;
      machineCtx.promptQueueIndex = 0;
      if (!machineCtx.autoMode) {
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
      }
    } else {
      ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
      ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
      ctx.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
      machineCtx.promptQueue = [];
      machineCtx.promptQueueIndex = 0;
    }

    ctx.machine.send({ type: 'STEP_COMPLETE', output: stepOutput });
    return { output: stepOutput };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      debug('[step/run] Step aborted');
      return null;
    }

    debug('[step/run] Step error: %s', (error as Error).message);
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'failed');
    ctx.machine.send({ type: 'STEP_ERROR', error: error as Error });
    return null;
  } finally {
    cleanupRun(ctx);
  }
}

/**
 * Run a step with resume (user/controller input)
 *
 * Called when we have input to send to an existing step session.
 */
export async function runStepResume(
  ctx: RunnerContext,
  options: RunStepOptions
): Promise<RunStepResult | null> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  debug('[step/run] Resuming step %d with input: %s...', stepIndex, options.resumePrompt?.slice(0, 50));

  // Get session ID from step data
  const stepData = await getStepData(ctx.cmRoot, stepIndex);
  const sessionId = options.resumeSessionId ?? stepData?.sessionId;

  // Setup (abort controller, UI status)
  const { abortController } = beforeRun({
    ctx,
    stepIndex,
    uniqueAgentId,
    isResume: true,
  });

  // Transition state machine to running
  ctx.machine.send({ type: 'RESUME' });
  ctx.emitter.setWorkflowStatus('running');

  try {
    const output = await executeStep(step, ctx.cwd, {
      logger: () => {},
      stderrLogger: () => {},
      emitter: ctx.emitter,
      abortSignal: abortController.signal,
      uniqueAgentId,
      resumeMonitoringId: options.resumeMonitoringId,
      resumeSessionId: sessionId,
      resumePrompt: options.resumePrompt,
    });

    // Update context with new output
    machineCtx.currentOutput = {
      output: output.output,
      monitoringId: output.monitoringId,
    };
    machineCtx.currentMonitoringId = output.monitoringId;

    const stepOutput: StateStepOutput = {
      output: output.output,
      monitoringId: output.monitoringId,
    };

    // Transition back to awaiting state
    ctx.machine.send({ type: 'STEP_COMPLETE', output: stepOutput });
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');

    return { output: stepOutput };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      debug('[step/run] Resume aborted');
      ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
      return null;
    }

    ctx.machine.send({ type: 'STEP_ERROR', error: error as Error });
    return null;
  } finally {
    cleanupRun(ctx);
  }
}
