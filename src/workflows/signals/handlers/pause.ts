/**
 * Pause Signal Handler
 *
 * Handles workflow:pause process events (user keypress Ctrl+P or 'p').
 * Captures session for resume, updates status, transitions state machine, and aborts.
 *
 * Delegates to WorkflowMode for pause state management.
 */

import { debug } from '../../../shared/logging/logger.js';
import { StatusService } from '../../../agents/monitoring/index.js';
import { setAutonomousMode } from '../../controller/config.js';
import { captureSession } from '../../../agents/session/index.js';
import type { SignalContext } from '../manager/types.js';

/**
 * Handle pause signal
 */
export async function handlePauseSignal(ctx: SignalContext): Promise<void> {
  debug('[PauseSignal] workflow:pause received, state=%s', ctx.machine.state);

  // In delegated state, the controller is running (not a step)
  // Pause it like a normal step - transition to awaiting and open input box
  if (ctx.machine.state === 'delegated') {
    debug('[PauseSignal] Pausing delegated state');

    // Persist mode change and emit event (controller will abort itself)
    // Use string 'false' not boolean - UI handler expects string values
    await setAutonomousMode(ctx.cmRoot, 'false');

    // Transition FSM: delegated -> awaiting (sets autoMode=false, paused=true)
    ctx.machine.send({ type: 'PAUSE' });

    // Sync mode state
    ctx.mode.pause();

    debug('[PauseSignal] Delegated state paused, input box will open');
    return;
  }

  const stepContext = ctx.getStepContext();
  if (!stepContext) {
    debug('[PauseSignal] No step context, ignoring pause');
    return;
  }

  // If in auto mode, switch to manual mode AND pause in one action
  // Users expect 'p' to pause immediately, not require two presses
  const wasAutoMode = ctx.mode.autoMode;
  if (wasAutoMode) {
    debug('[PauseSignal] Switching from auto to manual mode and pausing');
    // Persist to file first - this emits workflow:mode-change event
    // Controller listens for this and aborts itself with switchToManual=true
    // Use string 'false' not boolean - UI handler expects string values
    await setAutonomousMode(ctx.cmRoot, 'false');
    ctx.mode.disableAutoMode();
    // Continue to pause logic below (don't return early)
  }

  if (ctx.machine.state === 'running') {
    // Update UI status
    const status = StatusService.getInstance();
    status.awaiting(stepContext.agentId);

    // Transition state machine
    ctx.machine.send({ type: 'PAUSE' });

    // Set paused state via WorkflowMode (single source of truth)
    ctx.mode.pause();

    // Sync machine context
    const machineCtx = ctx.machine.context;
    machineCtx.paused = true;
    machineCtx.autoMode = false;

    // Capture session from monitor before aborting so resume can find it
    const session = captureSession(stepContext.agentId);
    if (session) {
      debug('[PauseSignal] Captured session: monitoringId=%d sessionId=%s', session.monitoringId, session.sessionId);

      // Set in machine context so handleWaiting can pass to resume
      machineCtx.currentMonitoringId = session.monitoringId;
      machineCtx.currentOutput = { output: '', monitoringId: session.monitoringId };

      // Persist session to step data for resume lookup
      if (session.sessionId) {
        ctx.indexManager.stepSessionInitialized(stepContext.stepIndex, session.sessionId, session.monitoringId)
          .catch(err => debug('[PauseSignal] Failed to save session: %s', err.message));
      }
    }

    // Abort the step execution
    ctx.getAbortController()?.abort();
  }

  debug('[PauseSignal] Pause handled');
}
