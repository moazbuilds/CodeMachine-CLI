/**
 * Resume Action
 *
 * Unified resume logic extracted from wait.ts and delegated.ts.
 * Handles resuming a step with user or controller input.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { RunnerContext } from '../types.js';
import type { ModeHandlerResult, ModeHandlerCallbacks } from '../modes/types.js';
import { runStepResume } from '../../step/run.js';
import { formatUserInput } from '../../../shared/formatters/outputMarkers.js';
import { AgentLoggerService } from '../../../agents/monitoring/index.js';
import { getUniqueAgentId } from '../../context/index.js';

/**
 * Options for resuming a step
 */
export interface ResumeOptions {
  /** Input to send */
  input: string;
  /** Monitoring ID for resume */
  monitoringId?: number;
  /** Source of input */
  source: 'user' | 'controller';
}

/**
 * Setup mode change handler for tracking mode switches during execution
 */
function setupModeChangeHandler(
  ctx: RunnerContext,
  onModeChange: (mode: 'manual' | 'auto') => void
): (data: { autonomousMode: boolean }) => void {
  const handler = (data: { autonomousMode: boolean }) => {
    debug('[actions/resume] Mode change during resume: autoMode=%s', data.autonomousMode);
    onModeChange(data.autonomousMode ? 'auto' : 'manual');
    ctx.getAbortController()?.abort();
  };
  process.on('workflow:mode-change', handler);
  return handler;
}

/**
 * Cleanup mode change handler
 */
function cleanupModeChangeHandler(
  handler: (data: { autonomousMode: boolean }) => void
): void {
  process.removeListener('workflow:mode-change', handler);
}

/**
 * Resume step with input
 *
 * Unified resume logic from handleResumeInput() in wait.ts
 * and handleControllerInput() in delegated.ts.
 */
export async function resumeWithInput(
  ctx: RunnerContext,
  options: ResumeOptions,
  callbacks: ModeHandlerCallbacks
): Promise<ModeHandlerResult> {
  const { input, monitoringId, source } = options;
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);
  const session = ctx.getCurrentSession();

  debug(
    '[actions/resume] Resuming step %d with input: %s... (source=%s)',
    stepIndex,
    input.slice(0, 50),
    source
  );

  // Detect and advance queue if input matches queued prompt
  let isQueuedPrompt = false;

  debug(
    '[actions/resume] Before queue check: session=%s, indexManager.queueIndex=%d, indexManager.queueLen=%d',
    session ? 'exists' : 'null',
    ctx.indexManager.promptQueueIndex,
    ctx.indexManager.promptQueue.length
  );

  if (session) {
    debug(
      '[actions/resume] Session state: queueIndex=%d, queueLen=%d, isQueueExhausted=%s',
      session.promptQueueIndex,
      session.promptQueue.length,
      session.isQueueExhausted
    );

    if (session.isQueuedPrompt(input)) {
      isQueuedPrompt = true;
      const chainIndex = session.promptQueueIndex;
      debug('[actions/resume] Input matches queued prompt at index %d, advancing...', chainIndex);
      session.advanceQueue();
      debug('[actions/resume] After advance: queueIndex=%d', ctx.indexManager.promptQueueIndex);
      await ctx.indexManager.chainCompleted(stepIndex, chainIndex);
    } else {
      debug('[actions/resume] Input does NOT match queued prompt (custom input)');
    }
  } else if (!ctx.indexManager.isQueueExhausted()) {
    if (ctx.indexManager.isQueuedPrompt(input)) {
      isQueuedPrompt = true;
      const chainIndex = ctx.indexManager.promptQueueIndex;
      ctx.indexManager.advanceQueue();
      debug('[actions/resume] Advanced queue to index %d', ctx.indexManager.promptQueueIndex);
      await ctx.indexManager.chainCompleted(stepIndex, chainIndex);
    }
  }

  // Log custom user input to file - skip for controller input
  if (!isQueuedPrompt && source !== 'controller') {
    const formatted = formatUserInput(input);
    if (monitoringId !== undefined) {
      AgentLoggerService.getInstance().write(monitoringId, `\n${formatted}\n`);
    }
  }

  // Resume from paused state
  ctx.mode.resume();
  machineCtx.paused = false;

  // Track mode switch during execution
  let modeSwitchRequested: 'manual' | 'auto' | null = null;
  const modeChangeHandler = setupModeChangeHandler(ctx, (mode) => {
    modeSwitchRequested = mode;
  });

  try {
    await runStepResume(ctx, {
      resumePrompt: input,
      resumeMonitoringId: monitoringId,
      source,
    });

    // Step completed successfully, back to awaiting
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
    return { type: 'continue' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (modeSwitchRequested) {
        debug('[actions/resume] Step aborted due to mode switch to %s', modeSwitchRequested);
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
        await callbacks.setAutoMode(modeSwitchRequested === 'auto');
        return { type: 'modeSwitch', to: modeSwitchRequested };
      }
      // Aborted for other reason (pause, skip)
      ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
      return { type: 'continue' };
    }
    throw error;
  } finally {
    cleanupModeChangeHandler(modeChangeHandler);
  }
}

/**
 * Send a queued prompt automatically (for autonomous mode)
 *
 * Advances the queue and sends the next prompt.
 */
export async function sendQueuedPrompt(
  ctx: RunnerContext,
  callbacks: ModeHandlerCallbacks
): Promise<ModeHandlerResult> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const session = ctx.getCurrentSession();

  // Get next prompt
  const nextPrompt = ctx.indexManager.getCurrentQueuedPrompt();
  if (!nextPrompt) {
    debug('[actions/resume] No prompt available');
    return { type: 'advance' };
  }

  const chainIndex = ctx.indexManager.promptQueueIndex;
  debug(
    '[actions/resume] Sending queued prompt %d: %s...',
    chainIndex,
    nextPrompt.content.slice(0, 50)
  );

  // Advance queue
  if (session) {
    session.advanceQueue();
  } else {
    ctx.indexManager.advanceQueue();
  }

  // Track chain completion
  await ctx.indexManager.chainCompleted(stepIndex, chainIndex);

  // Emit queue state change to UI
  ctx.emitter.setInputState({
    active: false, // Agent is running
    queuedPrompts: ctx.indexManager.promptQueue.map((p) => ({
      name: p.name,
      label: p.label,
      content: p.content,
    })),
    currentIndex: ctx.indexManager.promptQueueIndex,
    monitoringId: machineCtx.currentMonitoringId,
  });

  // Transition FSM to running
  ctx.machine.send({ type: 'RESUME' });

  // Resume with the prompt
  return resumeWithInput(
    ctx,
    {
      input: nextPrompt.content,
      monitoringId: machineCtx.currentMonitoringId,
      source: 'controller',
    },
    callbacks
  );
}
