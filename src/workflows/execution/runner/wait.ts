/**
 * Workflow Runner Waiting State Handling
 */

import { debug } from '../../../shared/logging/logger.js';
import { formatUserInput } from '../../../shared/formatters/outputMarkers.js';
import { AgentLoggerService } from '../../../agents/monitoring/index.js';
import type { InputContext } from '../../input/index.js';
import { executeStep } from '../step.js';
import {
  markStepCompleted,
  markChainCompleted,
  getStepData,
} from '../../../shared/workflows/steps.js';
import type { RunnerContext } from './types.js';

export interface WaitCallbacks {
  setAutoMode: (enabled: boolean) => Promise<void>;
}

/**
 * Handle waiting state - get input from provider
 */
export async function handleWaiting(ctx: RunnerContext, callbacks: WaitCallbacks): Promise<void> {
  const machineCtx = ctx.machine.context;

  debug('[Runner] Handling waiting state, autoMode=%s, paused=%s, promptQueue=%d items, queueIndex=%d',
    machineCtx.autoMode, machineCtx.paused, machineCtx.promptQueue.length, machineCtx.promptQueueIndex);

  // If paused, force user input provider (not controller)
  const provider = machineCtx.paused ? ctx.getUserInput() : ctx.getActiveProvider();
  if (machineCtx.paused) {
    debug('[Runner] Workflow is paused, using user input provider');
  }

  if (!machineCtx.paused && machineCtx.promptQueue.length === 0) {
    // No chained prompts and not paused - auto-advance to next step
    debug('[Runner] No chained prompts, auto-advancing to next step');
    const step = ctx.moduleSteps[machineCtx.currentStepIndex];
    const uniqueAgentId = `${step.agentId}-step-${machineCtx.currentStepIndex}`;
    ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
    ctx.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
    await markStepCompleted(ctx.cmRoot, machineCtx.currentStepIndex);
    ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
    return;
  }

  // Build input context
  const inputContext: InputContext = {
    stepOutput: machineCtx.currentOutput ?? { output: '' },
    stepIndex: machineCtx.currentStepIndex,
    totalSteps: machineCtx.totalSteps,
    promptQueue: machineCtx.promptQueue,
    promptQueueIndex: machineCtx.promptQueueIndex,
    cwd: ctx.cwd,
  };

  // Get input from provider (user input if paused, otherwise active provider)
  const result = await provider.getInput(inputContext);

  debug('[Runner] Got input result: type=%s', result.type);

  // Handle special switch-to-manual signal
  if (result.type === 'input' && result.value === '__SWITCH_TO_MANUAL__') {
    debug('[Runner] Switching to manual mode');
    await callbacks.setAutoMode(false);
    // Now show checkpoint since we're waiting for user input
    const step = ctx.moduleSteps[machineCtx.currentStepIndex];
    const uniqueAgentId = `${step.agentId}-step-${machineCtx.currentStepIndex}`;
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
    // Re-run waiting with user input
    return;
  }

  // Handle special switch-to-auto signal
  if (result.type === 'input' && result.value === '__SWITCH_TO_AUTO__') {
    debug('[Runner] Switching to autonomous mode');
    await callbacks.setAutoMode(true);
    // Re-run waiting with controller input
    return;
  }

  // Handle result
  const step = ctx.moduleSteps[machineCtx.currentStepIndex];
  const uniqueAgentId = `${step.agentId}-step-${machineCtx.currentStepIndex}`;

  switch (result.type) {
    case 'input':
      if (result.value === '') {
        // Empty input = advance to next step
        debug('[Runner] Empty input, marking agent completed and advancing');
        machineCtx.paused = false; // Clear paused flag
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
        ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
        ctx.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
        // Track step completion for resume
        await markStepCompleted(ctx.cmRoot, machineCtx.currentStepIndex);
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
      } else {
        // Has input = resume current step with input, then wait again
        await resumeWithInput(ctx, callbacks, result.value, result.resumeMonitoringId, result.source);
      }
      break;

    case 'skip':
      debug('[Runner] Skip requested, marking agent skipped');
      machineCtx.paused = false; // Clear paused flag
      ctx.emitter.updateAgentStatus(uniqueAgentId, 'skipped');
      ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} was skipped.`);
      ctx.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
      // Track step completion for resume
      await markStepCompleted(ctx.cmRoot, machineCtx.currentStepIndex);
      ctx.machine.send({ type: 'SKIP' });
      break;

    case 'stop':
      ctx.machine.send({ type: 'STOP' });
      break;
  }
}

/**
 * Resume current step with input (for chained prompts or steering)
 */
async function resumeWithInput(
  ctx: RunnerContext,
  callbacks: WaitCallbacks,
  input: string,
  monitoringId?: number,
  source?: 'user' | 'controller'
): Promise<void> {
  const machineCtx = ctx.machine.context;
  const step = ctx.moduleSteps[machineCtx.currentStepIndex];
  const uniqueAgentId = `${step.agentId}-step-${machineCtx.currentStepIndex}`;

  debug('[Runner] Resuming step with input: %s... (source=%s)', input.slice(0, 50), source ?? 'user');

  // Get sessionId from step data for resume
  const stepData = await getStepData(ctx.cmRoot, machineCtx.currentStepIndex);
  const sessionId = stepData?.sessionId;

  // Detect queued vs custom input
  let isQueuedPrompt = false;
  if (machineCtx.promptQueue.length > 0 && machineCtx.promptQueueIndex < machineCtx.promptQueue.length) {
    const queuedPrompt = machineCtx.promptQueue[machineCtx.promptQueueIndex];
    if (input === queuedPrompt.content) {
      isQueuedPrompt = true;
      const chainIndex = machineCtx.promptQueueIndex;
      machineCtx.promptQueueIndex += 1;
      debug('[Runner] Advanced queue to index %d', machineCtx.promptQueueIndex);
      // Track chain completion for resume
      await markChainCompleted(ctx.cmRoot, machineCtx.currentStepIndex, chainIndex);
    }
  }

  // Log custom user input (magenta) - skip for controller input (already logged during streaming)
  if (!isQueuedPrompt && source !== 'controller') {
    const formatted = formatUserInput(input);
    ctx.emitter.logMessage(uniqueAgentId, formatted);
    if (monitoringId !== undefined) {
      AgentLoggerService.getInstance().write(monitoringId, `\n${formatted}\n`);
    }
  }

  // Clear paused flag since we're resuming
  machineCtx.paused = false;

  const abortController = new AbortController();
  ctx.setAbortController(abortController);
  ctx.directiveManager.setAbortController(abortController);
  ctx.directiveManager.setStepContext({
    stepIndex: machineCtx.currentStepIndex,
    agentId: uniqueAgentId,
    agentName: step.agentName,
  });

  // Transition state machine to running so pause works
  ctx.machine.send({ type: 'RESUME' });

  ctx.emitter.updateAgentStatus(uniqueAgentId, 'running');
  ctx.emitter.setWorkflowStatus('running');

  // Track if mode switch was requested during execution
  let modeSwitchRequested: 'manual' | 'auto' | null = null;
  const modeChangeHandler = (data: { autonomousMode: boolean }) => {
    debug('[Runner] Mode change during resumeWithInput: autoMode=%s', data.autonomousMode);
    modeSwitchRequested = data.autonomousMode ? 'auto' : 'manual';
    // Abort the current step execution
    ctx.getAbortController()?.abort();
  };
  process.on('workflow:mode-change', modeChangeHandler);

  try {
    const output = await executeStep(step, ctx.cwd, {
      logger: () => {},
      stderrLogger: () => {},
      emitter: ctx.emitter,
      abortSignal: abortController.signal,
      uniqueAgentId,
      resumeMonitoringId: monitoringId,
      resumeSessionId: sessionId,
      resumePrompt: input,
    });

    // Update context with new output
    machineCtx.currentOutput = {
      output: output.output,
      monitoringId: output.monitoringId,
    };
    machineCtx.currentMonitoringId = output.monitoringId;

    // Transition back to awaiting state
    ctx.machine.send({
      type: 'STEP_COMPLETE',
      output: { output: output.output, monitoringId: output.monitoringId },
    });

    // Back to checkpoint while waiting for next input
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Handle mode switch during execution
      if (modeSwitchRequested) {
        debug('[Runner] Step aborted due to mode switch to %s', modeSwitchRequested);
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
        await callbacks.setAutoMode(modeSwitchRequested === 'auto');
      }
      // Directive (pause) already handled everything else
      return;
    }
    ctx.machine.send({ type: 'STEP_ERROR', error: error as Error });
  } finally {
    process.removeListener('workflow:mode-change', modeChangeHandler);
    ctx.setAbortController(null);
    ctx.directiveManager.setAbortController(null);
    // Keep stepContext - still valid during waiting state
  }
}
