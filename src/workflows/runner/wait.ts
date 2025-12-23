/**
 * Workflow Runner Waiting State Handling
 *
 * Handles the awaiting state - gets input from provider and processes it.
 */

import { debug } from '../../shared/logging/logger.js';
import { formatUserInput } from '../../shared/formatters/outputMarkers.js';
import { AgentLoggerService } from '../../agents/monitoring/index.js';
import type { InputContext } from '../input/index.js';
import { getUniqueAgentId } from '../context/index.js';
import { runStepResume } from '../step/run.js';
import {
  markStepCompleted,
  markChainCompleted,
} from '../../shared/workflows/steps.js';
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
    const uniqueAgentId = getUniqueAgentId(step, machineCtx.currentStepIndex);
    ctx.emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
    ctx.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
    await markStepCompleted(ctx.cmRoot, machineCtx.currentStepIndex);
    ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
    return;
  }

  // Build input context
  const step = ctx.moduleSteps[machineCtx.currentStepIndex];
  const stepUniqueAgentId = getUniqueAgentId(step, machineCtx.currentStepIndex);
  const inputContext: InputContext = {
    stepOutput: machineCtx.currentOutput ?? { output: '' },
    stepIndex: machineCtx.currentStepIndex,
    totalSteps: machineCtx.totalSteps,
    promptQueue: machineCtx.promptQueue,
    promptQueueIndex: machineCtx.promptQueueIndex,
    cwd: ctx.cwd,
    uniqueAgentId: stepUniqueAgentId,
  };

  // Get input from provider (user input if paused, otherwise active provider)
  const result = await provider.getInput(inputContext);

  debug('[Runner] Got input result: type=%s', result.type);

  // Handle special switch-to-manual signal
  if (result.type === 'input' && result.value === '__SWITCH_TO_MANUAL__') {
    debug('[Runner] Switching to manual mode');
    await callbacks.setAutoMode(false);
    ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'awaiting');
    return;
  }

  // Handle special switch-to-auto signal
  if (result.type === 'input' && result.value === '__SWITCH_TO_AUTO__') {
    debug('[Runner] Switching to autonomous mode');
    await callbacks.setAutoMode(true);
    return;
  }

  // Handle result
  switch (result.type) {
    case 'input':
      if (result.value === '') {
        // Empty input = advance to next step
        debug('[Runner] Empty input, marking agent completed and advancing');
        machineCtx.paused = false;
        ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'completed');
        ctx.emitter.logMessage(stepUniqueAgentId, `${step.agentName} has completed their work.`);
        ctx.emitter.logMessage(stepUniqueAgentId, '\n' + '═'.repeat(80) + '\n');
        await markStepCompleted(ctx.cmRoot, machineCtx.currentStepIndex);
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
      } else {
        // Has input = resume current step
        await handleResumeInput(ctx, callbacks, result.value, result.resumeMonitoringId, result.source);
      }
      break;

    case 'skip':
      debug('[Runner] Skip requested, marking agent skipped');
      machineCtx.paused = false;
      ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'skipped');
      ctx.emitter.logMessage(stepUniqueAgentId, `${step.agentName} was skipped.`);
      ctx.emitter.logMessage(stepUniqueAgentId, '\n' + '═'.repeat(80) + '\n');
      await markStepCompleted(ctx.cmRoot, machineCtx.currentStepIndex);
      ctx.machine.send({ type: 'SKIP' });
      break;

    case 'stop':
      ctx.machine.send({ type: 'STOP' });
      break;
  }
}

/**
 * Handle resume with input - delegates to step/run.ts
 */
async function handleResumeInput(
  ctx: RunnerContext,
  callbacks: WaitCallbacks,
  input: string,
  monitoringId?: number,
  source?: 'user' | 'controller'
): Promise<void> {
  const machineCtx = ctx.machine.context;
  const step = ctx.moduleSteps[machineCtx.currentStepIndex];
  const uniqueAgentId = getUniqueAgentId(step, machineCtx.currentStepIndex);

  debug('[Runner] Resuming step with input: %s... (source=%s)', input.slice(0, 50), source ?? 'user');

  // Detect queued vs custom input and advance queue if needed
  let isQueuedPrompt = false;
  if (machineCtx.promptQueue.length > 0 && machineCtx.promptQueueIndex < machineCtx.promptQueue.length) {
    const queuedPrompt = machineCtx.promptQueue[machineCtx.promptQueueIndex];
    if (input === queuedPrompt.content) {
      isQueuedPrompt = true;
      const chainIndex = machineCtx.promptQueueIndex;
      machineCtx.promptQueueIndex += 1;
      debug('[Runner] Advanced queue to index %d', machineCtx.promptQueueIndex);
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

  // Clear paused flag
  machineCtx.paused = false;

  // Track mode switch during execution
  let modeSwitchRequested: 'manual' | 'auto' | null = null;
  const modeChangeHandler = (data: { autonomousMode: boolean }) => {
    debug('[Runner] Mode change during resume: autoMode=%s', data.autonomousMode);
    modeSwitchRequested = data.autonomousMode ? 'auto' : 'manual';
    ctx.getAbortController()?.abort();
  };
  process.on('workflow:mode-change', modeChangeHandler);

  try {
    // Use unified step runner
    await runStepResume(ctx, {
      resumePrompt: input,
      resumeMonitoringId: monitoringId,
      source,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (modeSwitchRequested) {
        debug('[Runner] Step aborted due to mode switch to %s', modeSwitchRequested);
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
        await callbacks.setAutoMode(modeSwitchRequested === 'auto');
      }
      return;
    }
    throw error;
  } finally {
    process.removeListener('workflow:mode-change', modeChangeHandler);
  }
}
