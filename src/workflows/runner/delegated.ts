/**
 * Workflow Runner Delegated State Handling
 *
 * Handles the delegated state - controller agent is actively running.
 * Similar to running state but execution is delegated to controller.
 */

import { debug } from '../../shared/logging/logger.js';
import { formatUserInput } from '../../shared/formatters/outputMarkers.js';
import { AgentLoggerService } from '../../agents/monitoring/index.js';
import type { InputContext } from '../input/index.js';
import { getUniqueAgentId } from '../context/index.js';
import { runStepResume } from '../step/run.js';
import { resolveInteractiveBehavior } from '../step/interactive.js';
import { evaluateOnAdvance } from '../directives/index.js';
import type { RunnerContext } from './types.js';

export interface DelegatedCallbacks {
  setAutoMode: (enabled: boolean) => Promise<void>;
}

/**
 * Handle delegated state - controller agent is executing
 *
 * This is called when autoMode=true and !paused.
 * The controller agent runs and provides input to continue the workflow.
 */
export async function handleDelegated(ctx: RunnerContext, callbacks: DelegatedCallbacks): Promise<void> {
  const machineCtx = ctx.machine.context;

  debug('[Runner:delegated] Handling delegated state, promptQueue=%d items, queueIndex=%d',
    ctx.indexManager.promptQueue.length, ctx.indexManager.promptQueueIndex);

  // Get queue state from session
  const session = ctx.getCurrentSession();
  const hasChainedPrompts = session
    ? !session.isQueueExhausted
    : !ctx.indexManager.isQueueExhausted();

  // Get current step
  const step = ctx.moduleSteps[machineCtx.currentStepIndex];
  const stepUniqueAgentId = getUniqueAgentId(step, machineCtx.currentStepIndex);

  // Update agent status to delegated
  ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'delegated');

  // Resolve interactive behavior
  const behavior = resolveInteractiveBehavior({
    step,
    autoMode: true, // Always true in delegated state
    hasChainedPrompts,
    stepIndex: machineCtx.currentStepIndex,
  });

  debug('[Runner:delegated] Scenario=%d, shouldWait=%s, runAutonomousLoop=%s',
    behavior.scenario, behavior.shouldWait, behavior.runAutonomousLoop);

  // Handle Scenario 5: Fully autonomous prompt loop (interactive:false + autoMode + chainedPrompts)
  if (behavior.runAutonomousLoop) {
    debug('[Runner:delegated] Running autonomous prompt loop (Scenario 5)');
    await runAutonomousPromptLoop(ctx);
    return;
  }

  // Handle Scenario 6: Auto-advance (interactive:false + autoMode + no chainedPrompts)
  if (!behavior.shouldWait && !behavior.runAutonomousLoop) {
    debug('[Runner:delegated] Auto-advancing to next step (Scenario 6)');
    if (session) {
      await session.complete();
    }
    ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'completed');
    ctx.indexManager.resetQueue();
    await ctx.indexManager.stepCompleted(machineCtx.currentStepIndex);
    ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
    return;
  }

  // Scenarios 1-2: Controller provides input
  // Get controller provider (always use controller in delegated state)
  const provider = ctx.mode.getControllerInput();

  // Get queue state
  const queueState = session
    ? session.getQueueState()
    : { promptQueue: [...ctx.indexManager.promptQueue], promptQueueIndex: ctx.indexManager.promptQueueIndex };

  debug('[Runner:delegated] Queue state: queueLen=%d, queueIndex=%d',
    queueState.promptQueue.length, queueState.promptQueueIndex);

  const inputContext: InputContext = {
    stepOutput: machineCtx.currentOutput ?? { output: '' },
    stepIndex: machineCtx.currentStepIndex,
    totalSteps: machineCtx.totalSteps,
    promptQueue: queueState.promptQueue,
    promptQueueIndex: queueState.promptQueueIndex,
    cwd: ctx.cwd,
    uniqueAgentId: stepUniqueAgentId,
  };

  // Get input from controller
  const result = await provider.getInput(inputContext);

  debug('[Runner:delegated] Got controller result: type=%s', result.type);

  // Handle special switch-to-manual signal
  if (result.type === 'input' && result.value === '__SWITCH_TO_MANUAL__') {
    debug('[Runner:delegated] Controller switching to manual mode');
    await callbacks.setAutoMode(false);
    ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'awaiting');
    return;
  }

  // Handle result
  switch (result.type) {
    case 'input':
      if (result.value === '') {
        // Check directive before advancing
        const advanceAction = await evaluateOnAdvance(ctx.cwd);
        debug('[Runner:delegated] Empty input, directive action: %s', advanceAction.type);

        switch (advanceAction.type) {
          case 'loop':
            debug('[Runner:delegated] Directive: loop - staying on current step');
            ctx.emitter.logMessage(stepUniqueAgentId, `Loop requested${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            return;

          case 'stop':
            debug('[Runner:delegated] Directive: stop');
            ctx.emitter.logMessage(stepUniqueAgentId, `Stop requested${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            ctx.machine.send({ type: 'STOP' });
            return;

          case 'error':
            debug('[Runner:delegated] Directive: error');
            ctx.emitter.logMessage(stepUniqueAgentId, `Error: ${advanceAction.reason ?? 'Unknown error'}`);
            ctx.emitter.setWorkflowStatus('error');
            (process as NodeJS.EventEmitter).emit('workflow:error', { reason: advanceAction.reason });
            ctx.machine.send({ type: 'STOP' });
            return;

          case 'checkpoint':
            debug('[Runner:delegated] Directive: checkpoint');
            ctx.emitter.logMessage(stepUniqueAgentId, `Checkpoint${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            ctx.emitter.setCheckpointState({ active: true, reason: advanceAction.reason });
            return;

          case 'pause':
            debug('[Runner:delegated] Directive: pause - switching to manual mode');
            ctx.emitter.logMessage(stepUniqueAgentId, `Paused${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            await callbacks.setAutoMode(false);
            ctx.mode.pause();
            machineCtx.paused = true;
            ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'awaiting');
            return;

          case 'trigger':
            debug('[Runner:delegated] Directive: trigger agent %s', advanceAction.agentId);
            ctx.emitter.logMessage(stepUniqueAgentId, `Triggering ${advanceAction.agentId}${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            // TODO: Execute trigger agent, then advance
            break;

          case 'advance':
          default:
            // Continue with normal advance
            break;
        }

        // Default: advance to next step
        debug('[Runner:delegated] Advancing to next step');
        ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'completed');
        await ctx.indexManager.stepCompleted(machineCtx.currentStepIndex);
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
      } else {
        // Has input = resume current step with controller input
        await handleControllerInput(ctx, callbacks, result.value, result.resumeMonitoringId);
      }
      break;

    case 'skip':
      debug('[Runner:delegated] Controller requested skip');
      ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'skipped');
      await ctx.indexManager.stepCompleted(machineCtx.currentStepIndex);
      ctx.machine.send({ type: 'SKIP' });
      break;

    case 'stop':
      debug('[Runner:delegated] Controller requested stop');
      ctx.machine.send({ type: 'STOP' });
      break;
  }
}

/**
 * Run autonomous prompt loop (Scenario 5)
 *
 * Automatically sends the next chained prompt without controller involvement.
 */
async function runAutonomousPromptLoop(ctx: RunnerContext): Promise<void> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);
  const session = ctx.getCurrentSession();

  // Check if queue is exhausted
  const isExhausted = session
    ? session.isQueueExhausted
    : ctx.indexManager.isQueueExhausted();

  if (isExhausted) {
    debug('[Runner:delegated:autonomous] Queue exhausted, completing step %d', stepIndex);
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
    ctx.indexManager.resetQueue();
    await ctx.indexManager.stepCompleted(stepIndex);
    ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
    return;
  }

  // Get next prompt
  const nextPrompt = ctx.indexManager.getCurrentQueuedPrompt();
  if (!nextPrompt) {
    debug('[Runner:delegated:autonomous] No more prompts, completing step %d', stepIndex);
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
    ctx.indexManager.resetQueue();
    await ctx.indexManager.stepCompleted(stepIndex);
    ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
    return;
  }

  // Send the next prompt
  const chainIndex = ctx.indexManager.promptQueueIndex;
  debug('[Runner:delegated:autonomous] Sending prompt %d: %s...', chainIndex, nextPrompt.content.slice(0, 50));

  // Advance queue
  if (session) {
    session.advanceQueue();
  } else {
    ctx.indexManager.advanceQueue();
  }

  // Track chain completion
  await ctx.indexManager.chainCompleted(stepIndex, chainIndex);

  // Resume step with the prompt
  ctx.machine.send({ type: 'RESUME' });
  await runStepResume(ctx, {
    resumePrompt: nextPrompt.content,
    resumeMonitoringId: machineCtx.currentMonitoringId,
    source: 'controller',
  });
}

/**
 * Handle controller input - resume step with controller-provided input
 */
async function handleControllerInput(
  ctx: RunnerContext,
  callbacks: DelegatedCallbacks,
  input: string,
  monitoringId?: number
): Promise<void> {
  const machineCtx = ctx.machine.context;
  const step = ctx.moduleSteps[machineCtx.currentStepIndex];
  const uniqueAgentId = getUniqueAgentId(step, machineCtx.currentStepIndex);

  debug('[Runner:delegated] Resuming step with controller input: %s...', input.slice(0, 50));

  // Detect queued vs custom input and advance queue if needed
  const session = ctx.getCurrentSession();

  if (session) {
    if (session.isQueuedPrompt(input)) {
      const chainIndex = session.promptQueueIndex;
      debug('[Runner:delegated] Input matches queued prompt at index %d, advancing...', chainIndex);
      session.advanceQueue();
      await ctx.indexManager.chainCompleted(machineCtx.currentStepIndex, chainIndex);
    }
  } else if (!ctx.indexManager.isQueueExhausted()) {
    if (ctx.indexManager.isQueuedPrompt(input)) {
      const chainIndex = ctx.indexManager.promptQueueIndex;
      ctx.indexManager.advanceQueue();
      debug('[Runner:delegated] Advanced queue to index %d', ctx.indexManager.promptQueueIndex);
      await ctx.indexManager.chainCompleted(machineCtx.currentStepIndex, chainIndex);
    }
  }

  // Track mode switch during execution
  let modeSwitchRequested: 'manual' | null = null;
  const modeChangeHandler = (data: { autonomousMode: boolean }) => {
    if (!data.autonomousMode) {
      debug('[Runner:delegated] Mode change to manual during execution');
      modeSwitchRequested = 'manual';
      ctx.getAbortController()?.abort();
    }
  };
  process.on('workflow:mode-change', modeChangeHandler);

  try {
    // Resume step with controller input
    await runStepResume(ctx, {
      resumePrompt: input,
      resumeMonitoringId: monitoringId,
      source: 'controller',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (modeSwitchRequested === 'manual') {
        debug('[Runner:delegated] Step aborted due to mode switch to manual');
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
        await callbacks.setAutoMode(false);
      }
      return;
    }
    throw error;
  } finally {
    process.removeListener('workflow:mode-change', modeChangeHandler);
  }
}
