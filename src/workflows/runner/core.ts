/**
 * Workflow Runner Core
 *
 * Unified entry point that replaces wait.ts + delegated.ts.
 * Routes to appropriate mode handler based on resolved scenario.
 */

import { debug } from '../../shared/logging/logger.js';
import type { RunnerContext } from './types.js';
import type { ModeHandlerCallbacks, ModeHandlerResult } from './modes/types.js';
import { getModeHandler } from './modes/index.js';
import { resolveScenario, type ResolvedScenario } from '../step/scenarios/index.js';
import { getUniqueAgentId } from '../context/index.js';
import { DEFAULT_CONTINUATION_PROMPT } from '../../shared/prompts/index.js';
import { runStepResume } from '../step/run.js';

/**
 * Sync paused state from machineCtx to mode
 *
 * Used for crash recovery where machineCtx.paused is set directly.
 */
function syncPausedState(ctx: RunnerContext): void {
  const machineCtx = ctx.machine.context;
  if (machineCtx.paused && !ctx.mode.paused) {
    debug('[Runner:core] Syncing paused state from machineCtx to mode (recovery)');
    ctx.mode.pause();
  }
}

/**
 * Check if queue is exhausted
 */
function isQueueExhausted(ctx: RunnerContext): boolean {
  const session = ctx.getCurrentSession();
  return session ? session.isQueueExhausted : ctx.indexManager.isQueueExhausted();
}

/**
 * Resolve the effective interactive value for a step
 *
 * Handles undefined by defaulting to hasChainedPrompts.
 */
function resolveEffectiveInteractive(
  ctx: RunnerContext,
  hasChainedPrompts: boolean
): boolean {
  const machineCtx = ctx.machine.context;
  const step = ctx.moduleSteps[machineCtx.currentStepIndex];
  const interactive = step.interactive;

  if (interactive === undefined) {
    return hasChainedPrompts;
  }
  return interactive;
}

/**
 * Build resolved scenario with runtime context
 */
function buildScenario(ctx: RunnerContext): ResolvedScenario {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];

  const hasChainedPrompts = !isQueueExhausted(ctx);
  const interactive = resolveEffectiveInteractive(ctx, hasChainedPrompts);

  return resolveScenario({
    interactive,
    autoMode: ctx.mode.autoMode,
    hasChainedPrompts,
    stepIndex,
    stepName: step.agentName,
  });
}

/**
 * Handle continuation prompt for delegated state
 *
 * When entering auto mode, send continuation prompt to give agent a chance to continue.
 */
async function handleContinuationPrompt(
  ctx: RunnerContext,
  callbacks: ModeHandlerCallbacks
): Promise<boolean> {
  const machineCtx = ctx.machine.context;

  if (machineCtx.continuationPromptSent || !machineCtx.currentOutput) {
    return false;
  }

  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  debug('[Runner:core] Sending continuation prompt (first entry into auto mode)');

  // Mark as sent to prevent re-sending
  machineCtx.continuationPromptSent = true;

  // Update status and transition to running
  ctx.emitter.updateAgentStatus(uniqueAgentId, 'running');
  ctx.machine.send({ type: 'RESUME' });

  // Track mode switch during execution
  let modeSwitchRequested = false;
  const modeChangeHandler = (data: { autonomousMode: boolean }) => {
    if (!data.autonomousMode) {
      debug('[Runner:core] Mode change to manual during continuation prompt');
      modeSwitchRequested = true;
      ctx.getAbortController()?.abort();
    }
  };
  process.on('workflow:mode-change', modeChangeHandler);

  try {
    await runStepResume(ctx, {
      resumePrompt: DEFAULT_CONTINUATION_PROMPT,
      resumeMonitoringId: machineCtx.currentMonitoringId,
      source: 'controller',
    });

    debug('[Runner:core] Continuation prompt sent, agent responded');
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (modeSwitchRequested) {
        debug('[Runner:core] Continuation prompt aborted due to mode switch to manual');
        ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
        await callbacks.setAutoMode(false);
      }
      return true; // Handled
    }
    throw error;
  } finally {
    process.removeListener('workflow:mode-change', modeChangeHandler);
  }
}

/**
 * Handle current FSM state
 *
 * Unified entry point for both 'awaiting' and 'delegated' states.
 * Resolves scenario, gets handler, and processes result.
 *
 * @param ctx Runner context
 * @param callbacks Mode callbacks
 * @param fsmState Current FSM state ('awaiting' | 'delegated')
 */
export async function handleState(
  ctx: RunnerContext,
  callbacks: ModeHandlerCallbacks,
  fsmState: 'awaiting' | 'delegated'
): Promise<void> {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  // Sync paused state (for crash recovery)
  syncPausedState(ctx);

  debug(
    '[Runner:core] handleState fsmState=%s, autoMode=%s, paused=%s, queueLen=%d, queueIndex=%d',
    fsmState,
    ctx.mode.autoMode,
    ctx.mode.paused,
    ctx.indexManager.promptQueue.length,
    ctx.indexManager.promptQueueIndex
  );

  // Check if auto mode was disabled in delegated state
  if (fsmState === 'delegated' && !ctx.mode.autoMode) {
    debug('[Runner:core] Auto mode disabled, transitioning to awaiting state');
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'awaiting');
    ctx.machine.send({ type: 'AWAIT' });
    return;
  }

  // Handle continuation prompt for delegated state
  if (fsmState === 'delegated') {
    const handled = await handleContinuationPrompt(ctx, callbacks);
    if (handled) {
      return; // Continuation prompt handled, next call will continue
    }
  }

  // Update agent status for delegated state
  if (fsmState === 'delegated') {
    ctx.emitter.updateAgentStatus(uniqueAgentId, 'delegated');
  }

  // Resolve scenario
  const scenario = buildScenario(ctx);

  debug(
    '[Runner:core] Scenario %d (%s), modeType=%s, inputSource=%s',
    scenario.id,
    scenario.name,
    scenario.modeType,
    scenario.inputSource
  );

  // Force interactive mode when paused to block on user input
  const effectiveModeType = ctx.mode.paused ? 'interactive' : scenario.modeType;

  if (ctx.mode.paused && scenario.modeType !== 'interactive') {
    debug('[Runner:core] Paused - forcing interactive mode (was %s)', scenario.modeType);
  }

  // Get mode handler
  const handler = getModeHandler(effectiveModeType);

  // Execute handler
  const result = await handler.handle({
    ctx,
    scenario,
    callbacks,
    fsmState,
  });

  debug('[Runner:core] Handler result: %s', result.type);

  // Process result
  await processResult(ctx, result, callbacks);
}

/**
 * Process mode handler result
 *
 * Handles any post-processing needed based on the result.
 * Most state transitions are handled by the mode handlers themselves.
 */
async function processResult(
  ctx: RunnerContext,
  result: ModeHandlerResult,
  callbacks: ModeHandlerCallbacks
): Promise<void> {
  switch (result.type) {
    case 'modeSwitch':
      // Mode switch already handled by callback in handler
      break;

    case 'pause':
      // Pause handling - ensure mode is paused
      if (!ctx.mode.paused) {
        ctx.mode.pause();
        ctx.machine.context.paused = true;
      }
      break;

    case 'stop':
      // Stop is sent to FSM by handler
      break;

    case 'advance':
    case 'loop':
    case 'checkpoint':
    case 'continue':
    case 'error':
      // These are handled by the mode handlers
      break;
  }
}

// For backward compatibility - exports matching wait.ts/delegated.ts
export async function handleWaiting(
  ctx: RunnerContext,
  callbacks: ModeHandlerCallbacks
): Promise<void> {
  return handleState(ctx, callbacks, 'awaiting');
}

export async function handleDelegated(
  ctx: RunnerContext,
  callbacks: ModeHandlerCallbacks
): Promise<void> {
  return handleState(ctx, callbacks, 'delegated');
}
