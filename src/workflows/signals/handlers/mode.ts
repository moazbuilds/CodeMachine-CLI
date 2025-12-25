/**
 * Mode Change Signal Handler
 *
 * Handles workflow:mode-change process events.
 * Switches between user and auto (controller) input modes.
 *
 * Delegates to WorkflowMode for state management.
 * WorkflowMode is the single source of truth for mode state.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { SignalContext } from '../manager/types.js';

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

  // In other states (running, idle), set auto mode via WorkflowMode
  setAutoMode(ctx, data.autonomousMode);
}

/**
 * Set auto mode on/off
 *
 * Delegates to WorkflowMode which handles provider activation/deactivation.
 * Also syncs machine context to keep it consistent.
 */
export function setAutoMode(ctx: SignalContext, enabled: boolean): void {
  const machineCtx = ctx.machine.context;

  if (machineCtx.autoMode === enabled) {
    return;
  }

  debug('[Mode] Setting auto mode: %s', enabled);

  // Delegate to WorkflowMode (handles provider activation/deactivation)
  ctx.mode.setAutoMode(enabled);

  // Sync machine context
  machineCtx.autoMode = enabled;

  // When enabling auto mode, also clear paused state
  // Auto mode and paused are mutually exclusive
  if (enabled && machineCtx.paused) {
    debug('[Mode] Clearing paused state (auto mode enabled)');
    machineCtx.paused = false;
    ctx.mode.resume();
  }
}
