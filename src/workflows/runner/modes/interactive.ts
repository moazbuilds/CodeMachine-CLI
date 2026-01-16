/**
 * Interactive Mode Handler
 *
 * Handles scenarios 1-4, 7-8 where we wait for user or controller input.
 * Consolidated logic from wait.ts handleWaiting() and delegated.ts handleDelegated().
 */

import { debug } from '../../../shared/logging/logger.js';
import type { ModeHandler, ModeHandlerContext, ModeHandlerResult } from './types.js';
import type { InputContext, InputResult } from '../../input/types.js';
import {
  resumeWithInput,
  handleAdvanceDirective,
  advanceToNextStep,
  skipStep,
  resetDirective,
} from '../actions/index.js';
import { getUniqueAgentId } from '../../context/index.js';
import { StatusService } from '../../../agents/monitoring/index.js';

/**
 * Get queue state from session or indexManager
 */
function getQueueState(ctx: ModeHandlerContext['ctx']) {
  const session = ctx.getCurrentSession();
  return session
    ? session.getQueueState()
    : {
        promptQueue: [...ctx.indexManager.promptQueue],
        promptQueueIndex: ctx.indexManager.promptQueueIndex,
      };
}

/**
 * Build input context for provider
 */
function buildInputContext(ctx: ModeHandlerContext['ctx']): InputContext {
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);
  const queueState = getQueueState(ctx);

  return {
    step,
    stepOutput: machineCtx.currentOutput ?? { output: '' },
    stepIndex,
    totalSteps: machineCtx.totalSteps,
    promptQueue: queueState.promptQueue,
    promptQueueIndex: queueState.promptQueueIndex,
    cwd: ctx.cwd,
    uniqueAgentId,
  };
}

/**
 * Emit input state for UI
 */
function emitInputState(
  ctx: ModeHandlerContext['ctx'],
  scenario: ModeHandlerContext['scenario'],
  active: boolean
): void {
  const machineCtx = ctx.machine.context;
  const queueState = getQueueState(ctx);

  ctx.emitter.setInputState({
    active,
    queuedPrompts: queueState.promptQueue.map((p) => ({
      name: p.name,
      label: p.label,
      content: p.content,
    })),
    currentIndex: queueState.promptQueueIndex,
    monitoringId: machineCtx.currentMonitoringId,
  });
}

/**
 * Process input result from provider
 */
async function processInputResult(
  context: ModeHandlerContext,
  result: InputResult
): Promise<ModeHandlerResult> {
  const { ctx, callbacks } = context;
  const machineCtx = ctx.machine.context;
  const stepIndex = machineCtx.currentStepIndex;
  const step = ctx.moduleSteps[stepIndex];
  const uniqueAgentId = getUniqueAgentId(step, stepIndex);

  debug('[modes/interactive] Processing input result: type=%s', result.type);

  const status = StatusService.getInstance();

  // Handle special switch-to-manual signal
  if (result.type === 'input' && result.value === '__SWITCH_TO_MANUAL__') {
    debug('[modes/interactive] Switching to manual mode');
    await callbacks.setAutoMode(false);
    status.awaiting(uniqueAgentId);
    return { type: 'modeSwitch', to: 'manual' };
  }

  // Handle special switch-to-auto signal
  if (result.type === 'input' && result.value === '__SWITCH_TO_AUTO__') {
    debug('[modes/interactive] Switching to autonomous mode');
    await callbacks.setAutoMode(true);
    ctx.machine.send({ type: 'DELEGATE' });
    return { type: 'modeSwitch', to: 'auto' };
  }

  switch (result.type) {
    case 'input':
      if (result.value === '') {
        // Empty input = user wants to advance, reset directive to continue first
        await resetDirective(ctx.cwd);

        // Check directives (now reset to continue, so will advance)
        const directiveResult = await handleAdvanceDirective(ctx);

        if (directiveResult.type !== 'advance') {
          return directiveResult;
        }

        // Default: advance to next step
        return advanceToNextStep(ctx);
      } else {
        // Has input = resume current step
        return resumeWithInput(
          ctx,
          {
            input: result.value,
            monitoringId: result.resumeMonitoringId,
            source: result.source ?? 'user',
          },
          callbacks
        );
      }

    case 'skip':
      return skipStep(ctx);

    case 'stop':
      ctx.machine.send({ type: 'STOP' });
      return { type: 'stop' };
  }
}

/**
 * Interactive mode handler
 *
 * Handles all scenarios that wait for user or controller input.
 */
export const interactiveHandler: ModeHandler = {
  id: 'interactive',
  name: 'Interactive Mode',
  scenarios: [1, 2, 3, 4, 7, 8],

  async handle(context: ModeHandlerContext): Promise<ModeHandlerResult> {
    const { ctx, scenario, callbacks, fsmState } = context;
    const machineCtx = ctx.machine.context;
    const stepIndex = machineCtx.currentStepIndex;
    const step = ctx.moduleSteps[stepIndex];
    const uniqueAgentId = getUniqueAgentId(step, stepIndex);

    debug(
      '[modes/interactive] Handling scenario %d (%s), fsmState=%s, inputSource=%s',
      scenario.id,
      scenario.name,
      fsmState,
      scenario.inputSource
    );

    // Log warning for forced scenarios (7-8)
    if (scenario.wasForced && scenario.warningMessage) {
      ctx.emitter.logMessage(uniqueAgentId, scenario.warningMessage);
    }

    // Update agent status for user-facing scenarios
    if (scenario.inputSource === 'user') {
      const status = StatusService.getInstance();
      status.awaiting(uniqueAgentId);
    }

    // Get appropriate input provider based on scenario
    const provider =
      scenario.inputSource === 'controller'
        ? ctx.mode.getControllerInput()
        : ctx.mode.getUserInput();

    // Emit input state for UI
    // Active when: paused (waiting for user to resume), user input mode, or forced scenarios
    const isActive = ctx.mode.paused || scenario.inputSource === 'user' || scenario.wasForced;
    emitInputState(ctx, scenario, isActive);

    // Get input from provider
    const inputContext = buildInputContext(ctx);
    const result = await provider.getInput(inputContext);

    // Check if state changed while waiting (e.g., skip signal)
    if (fsmState === 'delegated' && ctx.machine.state !== 'delegated') {
      debug(
        '[modes/interactive] State changed from %s to %s while waiting, bailing out',
        fsmState,
        ctx.machine.state
      );
      return { type: 'continue' };
    }

    // Process input result
    return processInputResult(context, result);
  },
};
