/**
 * Input Handler
 *
 * Handles waiting for input and processing input results.
 * Extracted from WorkflowRunner for modularity.
 */

import { debug } from '../../shared/logging/logger.js';
import { formatUserInput } from '../../shared/formatters/outputMarkers.js';
import { AgentLoggerService, AgentMonitorService } from '../../agents/monitoring/index.js';
import {
  markChainCompleted,
  markStepCompleted,
  getStepData,
  updateStepDuration,
  updateStepTelemetry,
} from '../../shared/workflows/steps.js';
import type { ModuleStep } from '../templates/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { StateMachine, StepOutput } from '../state/index.js';
import type {
  InputProvider,
  InputContext,
  InputResult,
} from '../input/index.js';
import { executeStep } from './step.js';

/**
 * Input handler options
 */
export interface InputHandlerOptions {
  cwd: string;
  cmRoot: string;
  emitter: WorkflowEventEmitter;
  machine: StateMachine;
  moduleSteps: ModuleStep[];
  getActiveProvider: () => InputProvider;
  setAutoMode: (enabled: boolean) => Promise<void>;
  getAbortController: () => AbortController | null;
  setAbortController: (controller: AbortController | null) => void;
  isPauseRequested: () => boolean;
}

/**
 * Handles the waiting state - gets input from the active provider
 */
export async function handleWaiting(options: InputHandlerOptions): Promise<void> {
  const {
    cwd,
    cmRoot,
    emitter,
    machine,
    moduleSteps,
    getActiveProvider,
    setAutoMode,
  } = options;

  const ctx = machine.context;

  debug('[InputHandler] Handling waiting state, autoMode=%s, promptQueue=%d items, queueIndex=%d',
    ctx.autoMode, ctx.promptQueue.length, ctx.promptQueueIndex);

  // Build input context
  const inputContext: InputContext = {
    stepOutput: ctx.currentOutput ?? { output: '' },
    stepIndex: ctx.currentStepIndex,
    totalSteps: ctx.totalSteps,
    promptQueue: ctx.promptQueue,
    promptQueueIndex: ctx.promptQueueIndex,
    cwd,
  };

  // Get input from active provider
  const result = await getActiveProvider().getInput(inputContext);

  debug('[InputHandler] Got input result: type=%s', result.type);

  // Handle special switch-to-manual signal
  if (result.type === 'input' && result.value === '__SWITCH_TO_MANUAL__') {
    debug('[InputHandler] Switching to manual mode');
    await setAutoMode(false);
    // Re-run waiting with user input provider
    return;
  }

  // Handle special switch-to-auto signal
  if (result.type === 'input' && result.value === '__SWITCH_TO_AUTO__') {
    debug('[InputHandler] Switching to autonomous mode');
    await setAutoMode(true);
    // Re-run waiting with autopilot provider
    return;
  }

  // Handle wait-for-input signal (autopilot wants user to provide input)
  // FIX: Instead of just returning (which causes infinite loop), we need to
  // switch to user input temporarily to wait for actual input
  if (result.type === 'input' && result.value === '__WAIT_FOR_INPUT__') {
    debug('[InputHandler] Autopilot requested wait - switching to manual mode for input');
    // Switch to manual mode so user can provide input
    // The user will need to switch back to autopilot manually if desired
    await setAutoMode(false);
    return;
  }

  // Handle result
  const step = moduleSteps[ctx.currentStepIndex];
  const uniqueAgentId = `${step.agentId}-step-${ctx.currentStepIndex}`;

  switch (result.type) {
    case 'input':
      if (result.value === '') {
        // Empty input = advance to next step
        debug('[InputHandler] Empty input, marking agent completed and advancing');
        emitter.updateAgentStatus(uniqueAgentId, 'completed');
        emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
        emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
        // Track step completion for resume
        await markStepCompleted(cmRoot, ctx.currentStepIndex);
        machine.send({ type: 'INPUT_RECEIVED', input: '' });
      } else {
        // Has input = resume current step with input, then wait again
        await resumeWithInput(result.value, result.resumeMonitoringId, result.source, options);
      }
      break;

    case 'skip':
      debug('[InputHandler] Skip requested, marking agent skipped');
      emitter.updateAgentStatus(uniqueAgentId, 'skipped');
      emitter.logMessage(uniqueAgentId, `${step.agentName} was skipped.`);
      emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
      // Track step completion for resume - mark as skipped
      await markStepCompleted(cmRoot, ctx.currentStepIndex, { skipped: true });
      machine.send({ type: 'SKIP' });
      break;

    case 'stop':
      machine.send({ type: 'STOP' });
      break;

    case 'loop':
      // Loop = restart current step from beginning
      debug('[InputHandler] Loop requested, restarting current step');
      emitter.logMessage(uniqueAgentId, `Restarting ${step.agentName}...`);
      // Reset prompt queue for fresh start
      ctx.promptQueue = [];
      ctx.promptQueueIndex = 0;
      // Go back to running state to re-execute the step
      machine.send({ type: 'LOOP' });
      break;
  }
}

/**
 * Resume current step with input (for chained prompts or steering)
 */
export async function resumeWithInput(
  input: string,
  monitoringId: number | undefined,
  source: 'user' | 'autopilot' | 'controller' | undefined,
  options: InputHandlerOptions
): Promise<void> {
  const {
    cwd,
    cmRoot,
    emitter,
    machine,
    moduleSteps,
    setAutoMode,
    getAbortController,
    setAbortController,
    isPauseRequested,
  } = options;

  const ctx = machine.context;
  const step = moduleSteps[ctx.currentStepIndex];
  const uniqueAgentId = `${step.agentId}-step-${ctx.currentStepIndex}`;

  debug('[InputHandler] Resuming step with input: %s... (source=%s)', input.slice(0, 50), source ?? 'user');

  // Get sessionId from step data for resume
  const stepData = await getStepData(cmRoot, ctx.currentStepIndex);
  const sessionId = stepData?.sessionId;

  // Detect queued vs custom input
  let isQueuedPrompt = false;
  if (ctx.promptQueue.length > 0 && ctx.promptQueueIndex < ctx.promptQueue.length) {
    const queuedPrompt = ctx.promptQueue[ctx.promptQueueIndex];
    if (input === queuedPrompt.content) {
      isQueuedPrompt = true;
      const chainIndex = ctx.promptQueueIndex;
      ctx.promptQueueIndex += 1;
      debug('[InputHandler] Advanced queue to index %d', ctx.promptQueueIndex);
      // Track chain completion for resume
      await markChainCompleted(cmRoot, ctx.currentStepIndex, chainIndex);
    }
  }

  // Log custom user input (magenta) - skip for autopilot input (already logged during streaming)
  if (!isQueuedPrompt && source !== 'autopilot' && source !== 'controller') {
    const formatted = formatUserInput(input);
    emitter.logMessage(uniqueAgentId, formatted);
    if (monitoringId !== undefined) {
      AgentLoggerService.getInstance().write(monitoringId, `\n${formatted}\n`);
    }
  }

  // Track step start time for duration accumulation
  const stepStartTime = Date.now();

  const abortController = new AbortController();
  setAbortController(abortController);
  emitter.updateAgentStatus(uniqueAgentId, 'running');
  emitter.setWorkflowStatus('running');

  // Track if mode switch was requested during execution
  let modeSwitchRequested: 'manual' | 'auto' | null = null;
  const modeChangeHandler = (data: { autonomousMode: boolean }) => {
    debug('[InputHandler] Mode change during resumeWithInput: autoMode=%s', data.autonomousMode);
    modeSwitchRequested = data.autonomousMode ? 'auto' : 'manual';
    // Abort the current step execution
    getAbortController()?.abort();
  };
  process.on('workflow:mode-change', modeChangeHandler);

  try {
    const output = await executeStep(step, cwd, {
      logger: () => {},
      stderrLogger: () => {},
      emitter,
      abortSignal: abortController.signal,
      uniqueAgentId,
      resumeMonitoringId: monitoringId,
      resumeSessionId: sessionId,
      resumePrompt: input,
    });

    // Update context with new output
    ctx.currentOutput = {
      output: output.output,
      monitoringId: output.monitoringId,
    };
    ctx.currentMonitoringId = output.monitoringId;

    // Save accumulated duration
    const stepDuration = Date.now() - stepStartTime;
    await updateStepDuration(cmRoot, ctx.currentStepIndex, stepDuration);

    // Save accumulated telemetry
    if (output.monitoringId !== undefined) {
      const monitor = AgentMonitorService.getInstance();
      const agentInfo = monitor.getAgent(output.monitoringId);
      if (agentInfo?.telemetry) {
        await updateStepTelemetry(cmRoot, ctx.currentStepIndex, {
          tokensIn: agentInfo.telemetry.tokensIn ?? 0,
          tokensOut: agentInfo.telemetry.tokensOut ?? 0,
          cost: agentInfo.telemetry.cost ?? 0,
          cached: agentInfo.telemetry.cached,
        });
      }
    }

    // Back to checkpoint only in manual mode - in auto mode, keep running status
    if (!ctx.autoMode) {
      emitter.updateAgentStatus(uniqueAgentId, 'checkpoint');
    }

    // Stay in waiting state - will get more input
    // (The waiting handler will be called again)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Save accumulated duration for the time spent before abort
      const stepDuration = Date.now() - stepStartTime;
      await updateStepDuration(cmRoot, ctx.currentStepIndex, stepDuration);

      // Try to save telemetry if we have a monitoring ID
      if (ctx.currentMonitoringId !== undefined) {
        const monitor = AgentMonitorService.getInstance();
        const agentInfo = monitor.getAgent(ctx.currentMonitoringId);
        if (agentInfo?.telemetry) {
          await updateStepTelemetry(cmRoot, ctx.currentStepIndex, {
            tokensIn: agentInfo.telemetry.tokensIn ?? 0,
            tokensOut: agentInfo.telemetry.tokensOut ?? 0,
            cost: agentInfo.telemetry.cost ?? 0,
            cached: agentInfo.telemetry.cached,
          });
        }
      }

      if (isPauseRequested()) {
        machine.send({ type: 'PAUSE' });
        return;
      }
      // Handle mode switch during execution
      if (modeSwitchRequested) {
        debug('[InputHandler] Step aborted due to mode switch to %s', modeSwitchRequested);
        emitter.updateAgentStatus(uniqueAgentId, 'checkpoint');
        await setAutoMode(modeSwitchRequested === 'auto');
        // Return to let handleWaiting loop with new provider
        return;
      }
      return;
    }
    machine.send({ type: 'STEP_ERROR', error: error as Error });
  } finally {
    process.removeListener('workflow:mode-change', modeChangeHandler);
    setAbortController(null);
  }
}
