/**
 * Return to Controller Signal Handler
 *
 * Handles workflow:return-to-controller process events ('C' key).
 * Pauses workflow and re-enters controller conversation, then resumes.
 */

import { debug } from '../../../shared/logging/logger.js';
import { setAutonomousMode, loadControllerConfig } from '../../../shared/workflows/controller.js';
import { setControllerView } from '../../../shared/workflows/template.js';
import { AgentLoggerService } from '../../../agents/monitoring/index.js';
import { executeAgent } from '../../../agents/runner/runner.js';
import type { SignalContext } from '../manager/types.js';

/**
 * Handle return to controller signal
 * Pauses actual workflow, enters controller conversation, then resumes
 */
export async function handleReturnToControllerSignal(ctx: SignalContext): Promise<void> {
    debug('[ReturnToControllerSignal] Signal received, state=%s', ctx.machine.state);

    // Only handle if currently executing (running, awaiting, or delegated)
    if (ctx.machine.state !== 'running' && ctx.machine.state !== 'awaiting' && ctx.machine.state !== 'delegated') {
        debug('[ReturnToControllerSignal] Ignoring - not in running/awaiting/delegated state');
        return;
    }

    // Load controller config to get session info
    const controllerConfig = await loadControllerConfig(ctx.cmRoot);
    if (!controllerConfig?.controllerConfig?.sessionId) {
        debug('[ReturnToControllerSignal] No controller session found');
        return;
    }

    const { sessionId, monitoringId, agentId } = controllerConfig.controllerConfig;
    if (!sessionId || !monitoringId || !agentId) {
        debug('[ReturnToControllerSignal] Missing controller config');
        return;
    }

    debug('[ReturnToControllerSignal] Entering controller conversation: agentId=%s, sessionId=%s', agentId, sessionId);

    // CRITICAL: Pause the workflow state machine to stop runner from proceeding
    debug('[ReturnToControllerSignal] Pausing workflow state machine');
    ctx.machine.send({ type: 'PAUSE' });
    ctx.mode.pause();

    // Abort current step if running
    const abortController = ctx.getAbortController();
    if (abortController && !abortController.signal.aborted) {
        debug('[ReturnToControllerSignal] Aborting current step');
        abortController.abort();
    }

    // CRITICAL: Emit mode-change event with boolean false to abort ControllerInputProvider
    // This must be done BEFORE switching views to ensure the controller's executeWithActions aborts
    debug('[ReturnToControllerSignal] Emitting mode-change with autonomousMode=false to abort controller');
    (process as NodeJS.EventEmitter).emit('workflow:mode-change', { autonomousMode: false });

    // Switch to controller view
    await setControllerView(ctx.cmRoot, true);
    ctx.emitter.setWorkflowView('controller');
    ctx.emitter.updateControllerStatus('awaiting');

    // Set autonomous mode to never for conversation (file persistence)
    await setAutonomousMode(ctx.cmRoot, 'never');

    // Set input state active for controller conversation
    ctx.emitter.setInputState({
        active: true,
        monitoringId,
    });

    // Write a divider to the log
    const loggerService = AgentLoggerService.getInstance();
    loggerService.write(monitoringId, '\n\n━━━ RETURNING TO CONTROLLER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

    debug('[ReturnToControllerSignal] Entering conversation loop');

    // Run conversation loop - wait for user input
    await runReturnControllerLoop({
        sessionId,
        agentId,
        monitoringId,
        cwd: ctx.cwd,
        emitter: ctx.emitter,
    });

    debug('[ReturnToControllerSignal] Conversation ended, resuming workflow');

    // Clear input state and switch back to executing
    ctx.emitter.setInputState(null);
    ctx.emitter.updateControllerStatus('completed');
    await setControllerView(ctx.cmRoot, false);
    ctx.emitter.setWorkflowView('executing');

    // Restore autonomous mode
    await setAutonomousMode(ctx.cmRoot, 'true');

    // CRITICAL: Resume the workflow state machine
    debug('[ReturnToControllerSignal] Resuming workflow state machine');
    ctx.mode.resume();
    ctx.machine.send({ type: 'RESUME' });
}

interface LoopOptions {
    sessionId: string;
    agentId: string;
    monitoringId: number;
    cwd: string;
    emitter: SignalContext['emitter'];
}

/**
 * Controller conversation loop for return scenario
 */
async function runReturnControllerLoop(options: LoopOptions): Promise<void> {
    const { sessionId, agentId, monitoringId, cwd, emitter } = options;
    const loggerService = AgentLoggerService.getInstance();

    return new Promise((resolve, reject) => {
        const inputHandler = async (data: { prompt?: string; skip?: boolean }) => {
            debug('[ReturnToController] Received input: prompt="%s" skip=%s',
                data.prompt?.slice(0, 50) ?? '(empty)', data.skip ?? false);

            // Skip or empty = done
            if (data.skip || !data.prompt || data.prompt.trim() === '') {
                debug('[ReturnToController] Empty/skip - ending conversation');
                cleanup();
                resolve();
                return;
            }

            try {
                emitter.updateControllerStatus('running');

                // Echo user input to log
                loggerService.write(monitoringId, `\n\n━━━ USER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${data.prompt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`);

                debug('[ReturnToController] Resuming with sessionId=%s', sessionId);
                await executeAgent(agentId, data.prompt, {
                    workingDir: cwd,
                    resumeSessionId: sessionId,
                    resumePrompt: data.prompt,
                    resumeMonitoringId: monitoringId,
                });

                emitter.updateControllerStatus('awaiting');
                emitter.setInputState({ active: true, monitoringId });
                debug('[ReturnToController] Turn complete, waiting for next input');
            } catch (error) {
                debug('[ReturnToController] Error: %s', (error as Error).message);
                cleanup();
                reject(error);
            }
        };

        const continueHandler = () => {
            debug('[ReturnToController] Received continue signal');
            cleanup();
            resolve();
        };

        const cleanup = () => {
            (process as NodeJS.EventEmitter).off('workflow:input', inputHandler);
            (process as NodeJS.EventEmitter).off('workflow:controller-continue', continueHandler);
        };

        (process as NodeJS.EventEmitter).on('workflow:input', inputHandler);
        (process as NodeJS.EventEmitter).on('workflow:controller-continue', continueHandler);
    });
}
