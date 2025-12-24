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
import { initStepSession } from '../../../shared/workflows/steps.js';
import type { SignalContext } from '../manager/types.js';

/**
 * Handle pause signal
 */
export function handlePauseSignal(ctx: SignalContext): void {
  debug('[PauseSignal] workflow:pause received, state=%s', ctx.machine.state);

  const stepContext = ctx.getStepContext();
  if (!stepContext) {
    debug('[PauseSignal] No step context, ignoring pause');
    return;
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
      if (agent.sessionId) {
        initStepSession(ctx.cmRoot, stepContext.stepIndex, agent.sessionId, agent.id)
          .catch(err => debug('[PauseSignal] Failed to save session: %s', err.message));
      }
    }

    // Abort the step execution
    ctx.getAbortController()?.abort();
  }

  // Emit mode-change event so ControllerInputProvider can abort its execution
  // (it listens for this event to know when to stop)
  (process as NodeJS.EventEmitter).emit('workflow:mode-change', { autonomousMode: false });

  debug('[PauseSignal] Pause handled');
}
