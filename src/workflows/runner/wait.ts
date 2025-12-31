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
import { resolveInteractiveBehavior } from '../step/interactive.js';
import { evaluateOnAdvance } from '../directives/index.js';
import { processPostStepDirectives } from '../step/hooks.js';
import type { RunnerContext } from './types.js';

export interface WaitCallbacks {
  setAutoMode: (enabled: boolean) => Promise<void>;
}

/**
 * Handle waiting state - get input from provider
 *
 * Uses resolveInteractiveBehavior() for all 8 scenarios:
 * - Scenarios 1-4: Wait for controller/user input (shouldWait=true)
 * - Scenario 5: Run autonomous prompt loop (runAutonomousLoop=true)
 * - Scenario 6: Auto-advance to next step (queue exhausted after autonomous loop)
 * - Scenarios 7-8: Invalid cases forced to interactive:true (shouldWait=true)
 */
export async function handleWaiting(ctx: RunnerContext, callbacks: WaitCallbacks): Promise<void> {
  const machineCtx = ctx.machine.context;

  // Sync paused state from machineCtx to mode (for crash recovery)
  // Recovery sets machineCtx.paused directly, mode needs to be synced
  if (machineCtx.paused && !ctx.mode.paused) {
    debug('[Runner] Syncing paused state from machineCtx to mode (recovery)');
    ctx.mode.pause();
  }

  debug('[Runner] Handling waiting state, autoMode=%s, paused=%s, promptQueue=%d items, queueIndex=%d',
    ctx.mode.autoMode, ctx.mode.paused, ctx.indexManager.promptQueue.length, ctx.indexManager.promptQueueIndex);

  // Get current step info
  const step = ctx.moduleSteps[machineCtx.currentStepIndex];
  const stepUniqueAgentId = getUniqueAgentId(step, machineCtx.currentStepIndex);

  // Get queue state from session (uses indexManager as single source of truth)
  const session = ctx.getCurrentSession();
  const hasChainedPrompts = session
    ? !session.isQueueExhausted
    : !ctx.indexManager.isQueueExhausted();

  // Resolve interactive behavior using single source of truth
  const behavior = resolveInteractiveBehavior({
    step,
    autoMode: ctx.mode.autoMode,
    hasChainedPrompts,
    stepIndex: machineCtx.currentStepIndex,
  });

  debug('[Runner] Scenario=%d, shouldWait=%s, runAutonomousLoop=%s, wasForced=%s',
    behavior.scenario, behavior.shouldWait, behavior.runAutonomousLoop, behavior.wasForced);

  // Handle Scenarios 7-8: interactive:false in manual mode
  // Behave like normal manual mode: ensure agent is awaiting and show prompt box
  if (behavior.wasForced) {
    ctx.emitter.logMessage(stepUniqueAgentId, 'Manual mode active. Waiting for your input to continue. Use auto mode for fully autonomous execution.');
    ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'awaiting');
  }

  // Handle Scenario 5: Fully autonomous prompt loop (interactive:false + autoMode + chainedPrompts)
  if (!ctx.mode.paused && behavior.runAutonomousLoop) {
    debug('[Runner] Running autonomous prompt loop (Scenario 5)');
    await runAutonomousPromptLoop(ctx);
    return;
  }

  // Handle Scenario 6: Auto-advance (interactive:false + autoMode + no chainedPrompts)
  // This can happen when queue is exhausted after autonomous loop
  if (!ctx.mode.paused && !behavior.shouldWait && !behavior.runAutonomousLoop) {
    const action = await processPostStepDirectives({
      ctx,
      step,
      stepOutput: { output: machineCtx.currentOutput?.output ?? '' },
      stepIndex: machineCtx.currentStepIndex,
      uniqueAgentId: stepUniqueAgentId,
    });

    debug('[Runner:scenario6] Post-step action: %s', action.type);

    switch (action.type) {
      case 'stop':
        ctx.machine.send({ type: 'STOP' });
        return;

      case 'checkpoint':
        return;

      case 'pause': {
        debug('[Runner:scenario6] Directive: pause');
        ctx.emitter.logMessage(stepUniqueAgentId, `Paused${action.reason ? `: ${action.reason}` : ''}`);
        ctx.mode.pause();
        machineCtx.paused = true;
        ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'awaiting');
        // Enable input box for user to resume
        const pauseQueueState = session
          ? session.getQueueState()
          : { promptQueue: [...ctx.indexManager.promptQueue], promptQueueIndex: ctx.indexManager.promptQueueIndex };
        ctx.emitter.setInputState({
          active: true,
          queuedPrompts: pauseQueueState.promptQueue.map(p => ({ name: p.name, label: p.label, content: p.content })),
          currentIndex: pauseQueueState.promptQueueIndex,
          monitoringId: machineCtx.currentMonitoringId,
        });
        return;
      }

      case 'loop':
        debug('[Runner:scenario6] Loop to step %d', action.targetIndex);
        ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'completed');
        await ctx.indexManager.stepCompleted(machineCtx.currentStepIndex);
        ctx.indexManager.resetQueue();
        machineCtx.currentStepIndex = action.targetIndex;
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
        return;

      case 'advance':
      default:
        debug('[Runner] Auto-advancing to next step (Scenario 6)');
        if (session) {
          await session.complete();
        }
        ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'completed');
        ctx.indexManager.resetQueue();
        await ctx.indexManager.stepCompleted(machineCtx.currentStepIndex);
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
        return;
    }
  }

  // Get provider from WorkflowMode (single source of truth)
  // WorkflowMode.getActiveProvider() automatically handles paused and autoMode state
  const provider = ctx.mode.getActiveProvider();
  if (ctx.mode.paused) {
    debug('[Runner] Workflow is paused, using user input provider');
  } else if (!ctx.mode.autoMode) {
    debug('[Runner] Manual mode, using user input provider');
  }

  // Get queue state from session if available, otherwise from indexManager
  const queueState = session
    ? session.getQueueState()
    : { promptQueue: [...ctx.indexManager.promptQueue], promptQueueIndex: ctx.indexManager.promptQueueIndex };

  debug('[Runner] Queue state source: %s, queueLen=%d, queueIndex=%d',
    session ? 'session' : 'indexManager', queueState.promptQueue.length, queueState.promptQueueIndex);

  // For scenarios 7-8, emit input state immediately so UI shows prompt box
  // This must happen BEFORE provider.getInput() to avoid race condition
  if (behavior.wasForced) {
    ctx.emitter.setInputState({
      active: true,
      queuedPrompts: queueState.promptQueue.map(p => ({ name: p.name, label: p.label, content: p.content })),
      currentIndex: queueState.promptQueueIndex,
      monitoringId: machineCtx.currentMonitoringId,
    });
  }

  const inputContext: InputContext = {
    stepOutput: machineCtx.currentOutput ?? { output: '' },
    stepIndex: machineCtx.currentStepIndex,
    totalSteps: machineCtx.totalSteps,
    promptQueue: queueState.promptQueue,
    promptQueueIndex: queueState.promptQueueIndex,
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
    // Transition FSM from awaiting to delegated
    ctx.machine.send({ type: 'DELEGATE' });
    return;
  }

  // Handle result
  switch (result.type) {
    case 'input':
      if (result.value === '') {
        // Check directive before advancing
        const advanceAction = await evaluateOnAdvance(ctx.cwd);
        debug('[Runner] Empty input, directive action: %s', advanceAction.type);

        switch (advanceAction.type) {
          case 'loop':
            debug('[Runner] Directive: loop - staying on current step');
            ctx.emitter.logMessage(stepUniqueAgentId, `Loop requested${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            return;

          case 'stop':
            debug('[Runner] Directive: stop');
            ctx.emitter.logMessage(stepUniqueAgentId, `Stop requested${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            ctx.machine.send({ type: 'STOP' });
            return;

          case 'error':
            debug('[Runner] Directive: error');
            ctx.emitter.logMessage(stepUniqueAgentId, `Error: ${advanceAction.reason ?? 'Unknown error'}`);
            ctx.emitter.setWorkflowStatus('error');
            (process as NodeJS.EventEmitter).emit('workflow:error', { reason: advanceAction.reason });
            ctx.machine.send({ type: 'STOP' });
            return;

          case 'checkpoint':
            debug('[Runner] Directive: checkpoint');
            ctx.emitter.logMessage(stepUniqueAgentId, `Checkpoint${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            ctx.emitter.setCheckpointState({ active: true, reason: advanceAction.reason });
            return;

          case 'pause':
            debug('[Runner] Directive: pause');
            ctx.emitter.logMessage(stepUniqueAgentId, `Paused${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            ctx.mode.pause();
            machineCtx.paused = true;
            return;

          case 'trigger':
            debug('[Runner] Directive: trigger agent %s', advanceAction.agentId);
            ctx.emitter.logMessage(stepUniqueAgentId, `Triggering ${advanceAction.agentId}${advanceAction.reason ? `: ${advanceAction.reason}` : ''}`);
            // TODO: Execute trigger agent, then advance
            break;

          case 'advance':
          default:
            // Continue with normal advance
            break;
        }

        // Default: advance to next step
        debug('[Runner] Advancing to next step');
        ctx.mode.resume();
        machineCtx.paused = false; // Keep machine context in sync
        ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'completed');
        ctx.indexManager.resetQueue(); // Clear queue when advancing to prevent leaking to next step
        await ctx.indexManager.stepCompleted(machineCtx.currentStepIndex);
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
      } else {
        // Has input = resume current step
        await handleResumeInput(ctx, callbacks, result.value, result.resumeMonitoringId, result.source);
      }
      break;

    case 'skip':
      debug('[Runner] Skip requested, marking agent skipped');
      ctx.mode.resume();
      machineCtx.paused = false; // Keep machine context in sync
      ctx.emitter.updateAgentStatus(stepUniqueAgentId, 'skipped');
      ctx.indexManager.resetQueue(); // Clear queue when skipping to prevent leaking to next step
      await ctx.indexManager.stepCompleted(machineCtx.currentStepIndex);
      ctx.machine.send({ type: 'SKIP' });
      break;

    case 'stop':
      ctx.machine.send({ type: 'STOP' });
      break;
  }
}

/**
 * Run autonomous prompt loop (Scenario 5)
 *
 * Automatically sends the next chained prompt without controller/user involvement.
 * Each prompt runs through the state machine naturally - when it completes,
 * handleWaiting is called again and this function sends the next prompt.
 *
 * Used when interactive:false + autoMode + hasChainedPrompts.
 */
async function runAutonomousPromptLoop(ctx: RunnerContext): Promise<void> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);
  const session = ctx.getCurrentSession();

  // Check for pause directive BEFORE sending next prompt (regardless of queue state)
  const pauseResult = await evaluateOnAdvance(ctx.cwd);
  if (pauseResult.type === 'pause') {
    debug('[Runner:autonomous] Directive: pause (before next prompt)');
    ctx.emitter.logMessage(uniqueAgentId, `Paused${pauseResult.reason ? `: ${pauseResult.reason}` : ''}`);
    ctx.mode.pause();
    machineCtx.paused = true;
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
    // Enable input box for user to resume
    const queueState = session
      ? session.getQueueState()
      : { promptQueue: [...ctx.indexManager.promptQueue], promptQueueIndex: ctx.indexManager.promptQueueIndex };
    ctx.emitter.setInputState({
      active: true,
      queuedPrompts: queueState.promptQueue.map(p => ({ name: p.name, label: p.label, content: p.content })),
      currentIndex: queueState.promptQueueIndex,
      monitoringId: machineCtx.currentMonitoringId,
    });
    return;
  }

  // Check if queue is exhausted
  const isExhausted = session
    ? session.isQueueExhausted
    : ctx.indexManager.isQueueExhausted();

  if (isExhausted) {
    // Process directives (including loop) with full context
    const action = await processPostStepDirectives({
      ctx,
      step,
      stepOutput: { output: machineCtx.currentOutput?.output ?? '' },
      stepIndex,
      uniqueAgentId,
    });

    debug('[Runner:autonomous] Queue exhausted, post-step action: %s', action.type);

    switch (action.type) {
      case 'stop':
        ctx.machine.send({ type: 'STOP' });
        return;

      case 'checkpoint':
        // Checkpoint was handled by afterRun, just stay in current state
        return;

      case 'pause': {
        debug('[Runner:autonomous] Directive: pause');
        ctx.emitter.logMessage(uniqueAgentId, `Paused${action.reason ? `: ${action.reason}` : ''}`);
        ctx.mode.pause();
        machineCtx.paused = true;
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
        // Enable input box for user to resume
        const pauseQueueState = session
          ? session.getQueueState()
          : { promptQueue: [...ctx.indexManager.promptQueue], promptQueueIndex: ctx.indexManager.promptQueueIndex };
        ctx.emitter.setInputState({
          active: true,
          queuedPrompts: pauseQueueState.promptQueue.map(p => ({ name: p.name, label: p.label, content: p.content })),
          currentIndex: pauseQueueState.promptQueueIndex,
          monitoringId: machineCtx.currentMonitoringId,
        });
        return;
      }

      case 'loop':
        // Loop directive processed - rewind to target step
        debug('[Runner:autonomous] Loop to step %d', action.targetIndex);
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
        await ctx.indexManager.stepCompleted(stepIndex);
        ctx.indexManager.resetQueue();
        machineCtx.currentStepIndex = action.targetIndex;
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
        return;

      case 'advance':
      default:
        debug('[Runner:autonomous] Completing step %d', stepIndex);
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
        ctx.indexManager.resetQueue();
        await ctx.indexManager.stepCompleted(stepIndex);
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
        return;
    }
  }

  // Get next prompt
  const nextPrompt = ctx.indexManager.getCurrentQueuedPrompt();
  if (!nextPrompt) {
    // Fallback: queue not marked exhausted but no prompt available
    const action = await processPostStepDirectives({
      ctx,
      step,
      stepOutput: { output: machineCtx.currentOutput?.output ?? '' },
      stepIndex,
      uniqueAgentId,
    });

    debug('[Runner:autonomous] No prompts, post-step action: %s', action.type);

    switch (action.type) {
      case 'stop':
        ctx.machine.send({ type: 'STOP' });
        return;

      case 'checkpoint':
        return;

      case 'pause': {
        debug('[Runner:autonomous] Directive: pause (no prompts)');
        ctx.emitter.logMessage(uniqueAgentId, `Paused${action.reason ? `: ${action.reason}` : ''}`);
        ctx.mode.pause();
        machineCtx.paused = true;
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
        // Enable input box for user to resume
        const pauseQueueState = session
          ? session.getQueueState()
          : { promptQueue: [...ctx.indexManager.promptQueue], promptQueueIndex: ctx.indexManager.promptQueueIndex };
        ctx.emitter.setInputState({
          active: true,
          queuedPrompts: pauseQueueState.promptQueue.map(p => ({ name: p.name, label: p.label, content: p.content })),
          currentIndex: pauseQueueState.promptQueueIndex,
          monitoringId: machineCtx.currentMonitoringId,
        });
        return;
      }

      case 'loop':
        debug('[Runner:autonomous] Loop to step %d', action.targetIndex);
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
        await ctx.indexManager.stepCompleted(stepIndex);
        ctx.indexManager.resetQueue();
        machineCtx.currentStepIndex = action.targetIndex;
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
        return;

      case 'advance':
      default:
        debug('[Runner:autonomous] Completing step %d', stepIndex);
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'completed');
        ctx.indexManager.resetQueue();
        await ctx.indexManager.stepCompleted(stepIndex);
        ctx.machine.send({ type: 'INPUT_RECEIVED', input: '' });
        return;
    }
  }

  // Send the next prompt
  const chainIndex = ctx.indexManager.promptQueueIndex;
  debug('[Runner:autonomous] Sending prompt %d: %s...', chainIndex, nextPrompt.content.slice(0, 50));

  // Advance queue
  if (session) {
    session.advanceQueue();
  } else {
    ctx.indexManager.advanceQueue();
  }

  // Track chain completion
  await ctx.indexManager.chainCompleted(stepIndex, chainIndex);

  // Resume step with the prompt - when it completes, state machine will
  // transition back to awaiting and handleWaiting will be called again
  ctx.machine.send({ type: 'RESUME' });
  await runStepResume(ctx, {
    resumePrompt: nextPrompt.content,
    resumeMonitoringId: machineCtx.currentMonitoringId,
    source: 'controller',
  });
  // After runStepResume completes, machine goes back to awaiting state
  // and handleWaiting will be called again - it will detect Scenario 5
  // and call this function again to send the next prompt
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
  const session = ctx.getCurrentSession();

  debug('[Runner:handleResumeInput] Before queue check: session=%s, indexManager.queueIndex=%d, indexManager.queueLen=%d',
    session ? 'exists' : 'null', ctx.indexManager.promptQueueIndex, ctx.indexManager.promptQueue.length);

  if (session) {
    debug('[Runner:handleResumeInput] Session state: queueIndex=%d, queueLen=%d, isQueueExhausted=%s',
      session.promptQueueIndex, session.promptQueue.length, session.isQueueExhausted);
    // Use StepSession for queue management (delegates to indexManager)
    if (session.isQueuedPrompt(input)) {
      isQueuedPrompt = true;
      const chainIndex = session.promptQueueIndex;
      debug('[Runner:handleResumeInput] Input matches queued prompt at index %d, advancing...', chainIndex);
      session.advanceQueue();
      debug('[Runner:handleResumeInput] After advance: queueIndex=%d', ctx.indexManager.promptQueueIndex);
      await ctx.indexManager.chainCompleted(machineCtx.currentStepIndex, chainIndex);
    } else {
      debug('[Runner:handleResumeInput] Input does NOT match queued prompt (custom input)');
    }
  } else if (!ctx.indexManager.isQueueExhausted()) {
    // No session - use indexManager directly
    if (ctx.indexManager.isQueuedPrompt(input)) {
      isQueuedPrompt = true;
      const chainIndex = ctx.indexManager.promptQueueIndex;
      ctx.indexManager.advanceQueue();
      debug('[Runner] Advanced queue to index %d', ctx.indexManager.promptQueueIndex);
      await ctx.indexManager.chainCompleted(machineCtx.currentStepIndex, chainIndex);
    }
  }

  // Log custom user input to file - skip for controller input (already logged during streaming)
  if (!isQueuedPrompt && source !== 'controller') {
    const formatted = formatUserInput(input);
    if (monitoringId !== undefined) {
      AgentLoggerService.getInstance().write(monitoringId, `\n${formatted}\n`);
    }
  }

  // Resume from paused state
  ctx.mode.resume();
  machineCtx.paused = false; // Keep machine context in sync

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
