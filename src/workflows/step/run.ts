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
import { getSelectedConditions } from '../../shared/workflows/template.js';
import { loadAgentConfig } from '../../agents/runner/index.js';
import { loadChainedPrompts } from '../../agents/runner/chained.js';
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
  const stepData = await ctx.indexManager.getStepData(stepIndex);
  const isResuming = stepData?.sessionId && !stepData.completedAt;

  // If resuming from crash, go directly to waiting state
  if (isResuming) {
    debug('[step/run] Found resume data, going to waiting state');

    if (stepData.monitoringId !== undefined) {
      ctx.emitter.registerMonitoringId(uniqueAgentId, stepData.monitoringId);
    }

    ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');

    machineCtx.currentMonitoringId = stepData.monitoringId;
    machineCtx.currentOutput = {
      output: '',
      monitoringId: stepData.monitoringId,
    };

    // Restore queue from persisted completedChains
    if (stepData.completedChains && stepData.completedChains.length > 0) {
      const agentConfig = await loadAgentConfig(step.agentId, ctx.cwd);
      if (agentConfig?.chainedPromptsPath) {
        const selectedConditions = await getSelectedConditions(ctx.cmRoot);
        const chainedPrompts = await loadChainedPrompts(
          agentConfig.chainedPromptsPath,
          ctx.cwd,
          selectedConditions
        );
        if (chainedPrompts.length > 0) {
          const resumeIndex = Math.max(...stepData.completedChains) + 1;
          debug('[step/run] Restoring queue: %d prompts, resuming at index %d', chainedPrompts.length, resumeIndex);
          const session = ctx.getCurrentSession();
          if (session) {
            session.initializeFromPersisted(chainedPrompts, resumeIndex);
          } else {
            // Session should always exist - use indexManager directly as fallback
            ctx.indexManager.initQueue(chainedPrompts, resumeIndex);
          }
        }
      }
    }

    ctx.machine.send({
      type: 'STEP_COMPLETE',
      output: { output: '', monitoringId: stepData.monitoringId },
    });
    return null;
  }

  // Track step start for resume
  await ctx.indexManager.stepStarted(stepIndex);

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
      await ctx.indexManager.stepSessionInitialized(stepIndex, sessionId, output.monitoringId);
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
      indexManager: ctx.indexManager,
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
      ctx.indexManager.resetQueue();
      ctx.machine.send({ type: 'STEP_COMPLETE', output: stepOutput });
      return { output: stepOutput, checkpointContinued: true };
    }

    // Handle chained prompts via StepSession (uses indexManager as single source of truth)
    debug('[step/run] chainedPrompts: %d items', output.chainedPrompts?.length ?? 0);
    const session = ctx.getCurrentSession();
    if (session) {
      session.setOutput(stepOutput);
      const loaded = session.loadChainedPrompts(output.chainedPrompts);
      if (loaded) {
        session.markAwaiting();
        if (!machineCtx.autoMode) {
          ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
        }
      } else if (session.promptQueue.length === 0) {
        // Truly no prompts - complete the session
        await session.complete();
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
      }
      // If prompts exist but already loaded, no action needed - indexManager has the state
    } else if (output.chainedPrompts && output.chainedPrompts.length > 0) {
      // No session - use indexManager directly
      ctx.indexManager.initQueue(output.chainedPrompts, 0);
      if (!machineCtx.autoMode) {
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
      }
    } else {
      ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
      ctx.indexManager.resetQueue();
    }

    ctx.machine.send({ type: 'STEP_COMPLETE', output: stepOutput });
    return { output: stepOutput };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Signal handlers (pause/skip) handle status updates and state transitions
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
  const stepData = await ctx.indexManager.getStepData(stepIndex);
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

    // Use StepSession for chained prompts handling (uses indexManager as single source of truth)
    // StepSession.loadChainedPrompts only loads once (hasCompletedOnce check)
    const session = ctx.getCurrentSession();
    if (session) {
      session.setOutput(machineCtx.currentOutput);

      // If prompts not yet loaded, populate them
      // StepSession.loadChainedPrompts will only load if not already loaded
      if (output.chainedPrompts && output.chainedPrompts.length > 0) {
        const loaded = session.loadChainedPrompts(output.chainedPrompts);
        if (loaded) {
          debug('[step/run] Resume: Loaded %d chained prompts via StepSession', output.chainedPrompts.length);
        }
      }
    } else if (ctx.indexManager.isQueueExhausted() && output.chainedPrompts && output.chainedPrompts.length > 0) {
      // No session - use indexManager directly
      debug('[step/run] Resume: Populating queue with %d chained prompts via indexManager', output.chainedPrompts.length);
      ctx.indexManager.initQueue(output.chainedPrompts, 0);
    }

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
