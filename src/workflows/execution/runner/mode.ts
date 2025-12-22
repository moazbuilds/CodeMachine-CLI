/**
 * Workflow Runner Mode Management
 */

import { debug } from '../../../shared/logging/logger.js';
import type { RunnerContext } from './types.js';

/**
 * Set auto mode on/off
 */
export async function setAutoMode(ctx: RunnerContext, enabled: boolean): Promise<void> {
  const machineCtx = ctx.machine.context;

  if (machineCtx.autoMode === enabled) {
    return;
  }

  debug('[Runner] Setting auto mode: %s', enabled);

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
