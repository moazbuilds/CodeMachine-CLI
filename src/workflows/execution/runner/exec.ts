/**
 * Workflow Runner Step Execution
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

import { debug } from '../../../shared/logging/logger.js';
import { AgentMonitorService } from '../../../agents/monitoring/index.js';
import type { StepOutput } from '../../state/index.js';
import { executeStep } from '../step.js';
import { selectEngine } from '../engine.js';
import { registry } from '../../../infra/engines/index.js';
import {
  markStepStarted,
  initStepSession,
  getStepData,
} from '../../../shared/workflows/steps.js';
import { handlePostExec } from '../post.js';
import type { RunnerContext } from './types.js';

/**
 * Execute the current step
 */
export async function executeCurrentStep(ctx: RunnerContext): Promise<void> {
  const machineCtx = ctx.machine.context;
  const step = ctx.moduleSteps[machineCtx.currentStepIndex];
  const uniqueAgentId = `${step.agentId}-step-${machineCtx.currentStepIndex}`;

  debug('[Runner] Executing step %d: %s', machineCtx.currentStepIndex, step.agentName);

  // Check for resume data (existing session from previous run)
  const stepData = await getStepData(ctx.cmRoot, machineCtx.currentStepIndex);
  const isResuming = stepData?.sessionId && !stepData.completedAt;

  // If resuming, skip execution and go directly to waiting state
  if (isResuming) {
    debug('[Runner] Resuming step %d - going to waiting state', machineCtx.currentStepIndex);

    // Register monitoring ID so TUI loads existing logs
    if (stepData.monitoringId !== undefined) {
      ctx.emitter.registerMonitoringId(uniqueAgentId, stepData.monitoringId);
    }

    ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
    ctx.emitter.logMessage(uniqueAgentId, '═'.repeat(80));
    ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} resumed - waiting for input.`);

    // Set context with saved data
    machineCtx.currentMonitoringId = stepData.monitoringId;
    machineCtx.currentOutput = {
      output: '',
      monitoringId: stepData.monitoringId,
    };

    // Go to waiting state
    ctx.machine.send({
      type: 'STEP_COMPLETE',
      output: { output: '', monitoringId: stepData.monitoringId },
    });
    return;
  }

  // Track step start for resume
  await markStepStarted(ctx.cmRoot, machineCtx.currentStepIndex);

  // Clear paused flag for new step
  machineCtx.paused = false;

  // Reset all directives
  ctx.directiveManager.resetAll();

  // Set up abort controller
  const abortController = new AbortController();
  ctx.setAbortController(abortController);
  ctx.directiveManager.setAbortController(abortController);

  // Set step context for directives
  ctx.directiveManager.setStepContext({
    stepIndex: machineCtx.currentStepIndex,
    agentId: uniqueAgentId,
    agentName: step.agentName,
  });

  // Update UI
  ctx.emitter.updateAgentStatus(uniqueAgentId, 'running');
  ctx.emitter.logMessage(uniqueAgentId, '═'.repeat(80));
  ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} ${isResuming ? 'resumed work.' : 'started to work.'}`);

  // Reset directive file
  const directiveFile = path.join(ctx.cwd, '.codemachine/memory/directive.json');
  const directiveDir = path.dirname(directiveFile);
  if (!fs.existsSync(directiveDir)) {
    fs.mkdirSync(directiveDir, { recursive: true });
  }
  fs.writeFileSync(directiveFile, JSON.stringify({ action: 'continue' }, null, 2));

  // Determine engine
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
    // Execute the step (with resume data if available)
    const output = await executeStep(step, ctx.cwd, {
      logger: () => {},
      stderrLogger: () => {},
      emitter: ctx.emitter,
      abortSignal: abortController.signal,
      uniqueAgentId,
      resumeMonitoringId: isResuming ? stepData.monitoringId : undefined,
      resumeSessionId: isResuming ? stepData.sessionId : undefined,
      resumePrompt: isResuming ? 'Continue from where you left off.' : undefined,
    });

    // Step completed
    debug('[Runner] Step completed');

    // Track session info for resume
    if (output.monitoringId !== undefined) {
      const monitor = AgentMonitorService.getInstance();
      const agentInfo = monitor.getAgent(output.monitoringId);
      const sessionId = agentInfo?.sessionId ?? '';
      await initStepSession(ctx.cmRoot, machineCtx.currentStepIndex, sessionId, output.monitoringId);
    }

    const stepOutput: StepOutput = {
      output: output.output,
      monitoringId: output.monitoringId,
    };

    // Handle post-execution directives (error, trigger, checkpoint, loop)
    const postResult = await handlePostExec({
      step,
      stepOutput: { output: output.output },
      cwd: ctx.cwd,
      cmRoot: ctx.cmRoot,
      index: machineCtx.currentStepIndex,
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
      debug('[Runner] Workflow should stop due to directive');
      ctx.machine.send({ type: 'STOP' });
      return;
    }

    // Update active loop state
    if (postResult.newActiveLoop !== undefined) {
      ctx.setActiveLoop(postResult.newActiveLoop);
    }

    // Handle loop - rewind to previous step
    // newIndex is calculated as (index - stepsBack - 1) for use with a for-loop's i++
    // Since we set currentStepIndex directly, we add 1 to get the correct target
    if (postResult.newIndex !== undefined) {
      const targetIndex = postResult.newIndex + 1;
      if (targetIndex >= 0 && targetIndex <= machineCtx.currentStepIndex) {
        debug('[Runner] Loop directive: rewinding to step %d', targetIndex);
        machineCtx.currentStepIndex = targetIndex;
        // Don't send STEP_COMPLETE - just return to let the main loop re-execute
        return;
      }
    }

    // Checkpoint continued - skip chained prompts and advance to next step
    if (postResult.checkpointContinued) {
      debug('[Runner] Checkpoint continued, advancing to next step');
      ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
      ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} checkpoint completed.`);
      ctx.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
      ctx.machine.context.promptQueue = [];
      ctx.machine.context.promptQueueIndex = 0;
      ctx.machine.send({ type: 'STEP_COMPLETE', output: stepOutput });
      return;
    }

    // Update context with chained prompts if any
    debug('[Runner] chainedPrompts from output: %d items', output.chainedPrompts?.length ?? 0);
    if (output.chainedPrompts && output.chainedPrompts.length > 0) {
      debug('[Runner] Setting promptQueue with %d chained prompts:', output.chainedPrompts.length);
      output.chainedPrompts.forEach((p, i) => debug('[Runner]   [%d] %s: %s', i, p.name, p.label));
      ctx.machine.context.promptQueue = output.chainedPrompts;
      ctx.machine.context.promptQueueIndex = 0;
      // In auto mode, keep status as 'running' - controller will run next
      // In manual mode, show checkpoint - waiting for user input
      if (!ctx.machine.context.autoMode) {
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
        debug('[Runner] Agent at checkpoint, waiting for user input');
      } else {
        debug('[Runner] Auto mode - keeping status as running for controller');
      }
    } else {
      debug('[Runner] No chained prompts, marking agent completed');
      ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
      ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
      ctx.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
      ctx.machine.context.promptQueue = [];
      ctx.machine.context.promptQueueIndex = 0;
    }

    ctx.machine.send({ type: 'STEP_COMPLETE', output: stepOutput });
  } catch (error) {
    // Handle abort - directive already handled everything (log, state machine)
    if (error instanceof Error && error.name === 'AbortError') {
      debug('[Runner] Step aborted - directive handled it');
      return;
    }

    // Real error
    debug('[Runner] Step error: %s', (error as Error).message);
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'failed');
    ctx.machine.send({ type: 'STEP_ERROR', error: error as Error });
  } finally {
    ctx.setAbortController(null);
    ctx.directiveManager.setAbortController(null);
    // Keep stepContext - still valid during waiting state
  }
}
