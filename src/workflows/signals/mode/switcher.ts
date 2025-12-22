/**
 * Mode Switcher
 *
 * Handles switching between user and auto (controller) input modes.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { ModeSwitchContext } from './types.js';

/**
 * Set auto mode on/off
 *
 * Switches the active input provider between user and controller.
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
