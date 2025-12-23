/**
 * Mode Change Signal Handler
 *
 * Handles workflow:mode-change process events.
 * Switches between user and auto (controller) input modes.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { SignalContext, ModeSwitchContext } from '../manager/types.js';

/**
 * Handle mode change signal
 */
export async function handleModeChangeSignal(
  ctx: SignalContext,
  data: { autonomousMode: boolean }
): Promise<void> {
  debug(
    '[ModeSignal] workflow:mode-change received, autoMode=%s',
    data.autonomousMode
  );

  // If in waiting state, let the provider's listener handle it
  // The provider will return __SWITCH_TO_AUTO__ or __SWITCH_TO_MANUAL__
  // and handleWaiting() will call setAutoMode()
  if (ctx.machine.state === 'awaiting') {
    debug('[ModeSignal] In awaiting state, provider will handle mode switch');
    return;
  }

  // In other states (running, idle), set auto mode directly
  await setAutoMode(ctx, data.autonomousMode);
}

/**
 * Set auto mode on/off
 *
 * Switches the active input provider between user and controller.
 * Exported for direct use by runner.setAutoMode()
 */
export async function setAutoMode(
  ctx: ModeSwitchContext,
  enabled: boolean
): Promise<void> {
  const machineCtx = ctx.machine.context;

  if (machineCtx.autoMode === enabled) {
    return;
  }

  debug('[Mode] Setting auto mode: %s', enabled);

  // Deactivate current provider
  const currentProvider = ctx.getActiveProvider();
  currentProvider.deactivate?.();

  // Update context
  machineCtx.autoMode = enabled;

  // Activate new provider
  if (enabled) {
    ctx.setActiveProvider(ctx.getControllerInput());
  } else {
    ctx.setActiveProvider(ctx.getUserInput());
  }
  ctx.getActiveProvider().activate?.();
}
