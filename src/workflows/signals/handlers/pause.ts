/**
 * Pause Signal Handler
 *
 * Handles workflow:pause process events (user keypress Ctrl+P or 'p').
 * Captures session for resume, updates status, transitions state machine, and aborts.
 *
 * Delegates to WorkflowMode for pause state management.
 */

import { debug } from '../../../shared/logging/logger.js';
import { AgentMonitorService } from '../../../agents/monitoring/index.js';
import { setAutonomousMode } from '../../../shared/workflows/controller.js';
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
    await setAutonomousMode(ctx.cmRoot, false);

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
    await setAutonomousMode(ctx.cmRoot, false);
    ctx.mode.disableAutoMode();
    // Continue to pause logic below (don't return early)
  }

  if (ctx.machine.state === 'running') {
    // Update UI status
    ctx.emitter.updateAgentStatus(stepContext.agentId, 'awaiting');

    // Transition state machine
    ctx.machine.send({ type: 'PAUSE' });

    // Set paused state via WorkflowMode (single source of truth)
    ctx.mode.pause();

    // Sync machine context
    const machineCtx = ctx.machine.context;
    machineCtx.paused = true;
    machineCtx.autoMode = false;

    // Capture session from monitor before aborting so resume can find it
    // Agent is registered with base ID (e.g., "bmad-architect" not "bmad-architect-step-2")
    const baseAgentId = stepContext.agentId.replace(/-step-\d+$/, '');
    const monitor = AgentMonitorService.getInstance();
    const agents = monitor.queryAgents({ name: baseAgentId });

    if (agents.length > 0) {
      const agent = agents.reduce((a, b) => (a.id > b.id ? a : b));
      debug('[PauseSignal] Captured agent: id=%d sessionId=%s', agent.id, agent.sessionId);

      // Set in machine context so handleWaiting can pass to resume
      machineCtx.currentMonitoringId = agent.id;
      machineCtx.currentOutput = { output: '', monitoringId: agent.id };

      // Persist session to step data for resume lookup
      // Uses indexManager for centralized lifecycle tracking
      if (agent.sessionId) {
        ctx.indexManager.stepSessionInitialized(stepContext.stepIndex, agent.sessionId, agent.id)
          .catch(err => debug('[PauseSignal] Failed to save session: %s', err.message));
      }
    }

    // Abort the step execution
    ctx.getAbortController()?.abort();
  }

  debug('[PauseSignal] Pause handled');
}
