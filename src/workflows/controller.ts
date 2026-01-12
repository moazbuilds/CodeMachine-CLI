/**
 * Controller Phase
 *
 * Runs the controller agent before workflow steps begin.
 * Sets phase='onboarding', runs controller in conversational loop,
 * waits for user to press Enter to continue, then switches to phase='executing'.
 */

import type { WorkflowTemplate } from './templates/types.js';
import type { WorkflowEventBus } from './events/event-bus.js';
import type { WorkflowEventEmitter } from './events/emitter.js';
import {
  getControllerAgents,
  initControllerAgent,
  loadControllerConfig,
} from '../shared/workflows/controller.js';
import { executeAgent } from '../agents/runner/runner.js';
import { registry } from '../infra/engines/index.js';
import { debug } from '../shared/logging/logger.js';

export interface ControllerPhaseOptions {
  cwd: string;
  cmRoot: string;
  template: WorkflowTemplate;
  emitter: WorkflowEventEmitter;
  eventBus: WorkflowEventBus;
}

export interface ControllerPhaseResult {
  /** Whether controller phase ran (false if skipped) */
  ran: boolean;
  /** Controller agent ID if ran */
  agentId?: string;
}

/**
 * Run the controller phase if needed.
 *
 * This function:
 * 1. Checks if controller is required (template.controller === true)
 * 2. Checks if controller session already exists (skip if so)
 * 3. Sets phase to 'onboarding'
 * 4. Initializes and runs the controller agent
 * 5. Waits for user to press Enter (via workflow:controller-continue event)
 * 6. Sets phase to 'executing'
 *
 * @returns Result indicating if controller ran
 */
export async function runControllerPhase(
  options: ControllerPhaseOptions
): Promise<ControllerPhaseResult> {
  const { cwd, cmRoot, template, emitter, eventBus } = options;

  debug('[ControllerPhase] Starting controller phase check');

  // Check if template requires controller
  if (template.controller !== true) {
    debug('[ControllerPhase] Template does not require controller, skipping');
    return { ran: false };
  }

  // Check if controller session already exists
  const existingConfig = await loadControllerConfig(cmRoot);
  if (existingConfig?.controllerConfig?.sessionId) {
    debug('[ControllerPhase] Controller session already exists, skipping init');
    // Still set autonomous mode if controller exists
    emitter.setWorkflowPhase('executing');
    return { ran: false };
  }

  // Get available controller agents
  const controllerAgents = await getControllerAgents(cwd);
  if (controllerAgents.length === 0) {
    debug('[ControllerPhase] No controller agents found, skipping');
    emitter.setWorkflowPhase('executing');
    return { ran: false };
  }

  // Use first controller agent (could add selection logic later)
  const controller = controllerAgents[0];
  debug('[ControllerPhase] Using controller agent: %s', controller.id);

  // Resolve engine and model
  const defaultEngine = registry.getDefault();
  const engineType = controller.engine ?? defaultEngine?.metadata.id ?? 'claude';
  const engineModule = registry.get(engineType);
  const resolvedModel = controller.model ?? engineModule?.metadata.defaultModel;

  // Set phase to onboarding
  debug('[ControllerPhase] Setting phase to onboarding');
  emitter.setWorkflowPhase('onboarding');

  // Emit controller info for UI
  const controllerName = (controller.name as string | undefined) ?? controller.id;
  emitter.setControllerInfo(
    controller.id,
    controllerName,
    engineType,
    resolvedModel as string | undefined
  );
  emitter.updateControllerStatus('running');

  // Get prompt path from controller definition
  const promptPath = controller.promptPath as string | string[] | undefined;
  if (!promptPath) {
    debug('[ControllerPhase] Controller has no prompt path, skipping');
    emitter.updateControllerStatus('failed');
    emitter.setWorkflowPhase('executing');
    return { ran: false };
  }

  // Initialize controller agent
  debug('[ControllerPhase] Initializing controller agent');
  let controllerMonitoringId: number | undefined;

  try {
    const config = await initControllerAgent(
      controller.id,
      promptPath,
      cwd,
      cmRoot,
      {
        onMonitoringId: (monitoringId) => {
          debug('[ControllerPhase] Controller monitoring ID: %d', monitoringId);
          controllerMonitoringId = monitoringId;
          emitter.registerControllerMonitoring(monitoringId);
        },
      }
    );

    debug('[ControllerPhase] Controller initialized: sessionId=%s, monitoringId=%d', config.sessionId, controllerMonitoringId);

    // Set up conversational loop
    // 1. Set input state active so UI shows input box
    // 2. Wait for user input
    // 3. Resume conversation with input
    // 4. Repeat until user presses Enter without input
    emitter.updateControllerStatus('awaiting');
    emitter.setInputState({
      active: true,
      monitoringId: controllerMonitoringId,
    });

    debug('[ControllerPhase] Input state set, starting conversation loop');

    // Conversation loop - wait for input or continue signal
    await runControllerConversationLoop({
      sessionId: config.sessionId,
      agentId: controller.id,
      monitoringId: controllerMonitoringId!,
      cwd,
      emitter,
    });

    debug('[ControllerPhase] Conversation loop ended, transitioning to executing phase');

    // Clear input state and switch to executing phase
    emitter.setInputState(null);
    emitter.updateControllerStatus('completed');
    emitter.setWorkflowPhase('executing');

    return { ran: true, agentId: controller.id };
  } catch (error) {
    debug('[ControllerPhase] Controller phase failed: %s', (error as Error).message);
    emitter.setInputState(null);
    emitter.updateControllerStatus('failed');
    emitter.setWorkflowPhase('executing');
    throw error;
  }
}

interface ConversationLoopOptions {
  sessionId: string;
  agentId: string;
  monitoringId: number;
  cwd: string;
  emitter: WorkflowEventEmitter;
}

/**
 * Run the controller conversation loop.
 * Waits for user input and resumes conversation until user presses Enter (continue signal).
 */
async function runControllerConversationLoop(options: ConversationLoopOptions): Promise<void> {
  const { sessionId, agentId, monitoringId, cwd, emitter } = options;

  return new Promise((resolve, reject) => {
    // Handler for user input (workflow:input event from UI)
    const inputHandler = async (data: { prompt?: string; skip?: boolean }) => {
      debug('[ControllerPhase] Received input event: prompt="%s" skip=%s',
        data.prompt?.slice(0, 50) ?? '(empty)', data.skip ?? false);

      // Skip signal means user wants to end controller phase
      if (data.skip) {
        debug('[ControllerPhase] Skip signal - ending conversation');
        cleanup();
        resolve();
        return;
      }

      // Empty prompt means user is done (pressed Enter without typing)
      if (!data.prompt || data.prompt.trim() === '') {
        debug('[ControllerPhase] Empty prompt - ending conversation');
        cleanup();
        resolve();
        return;
      }

      // Resume conversation with user input
      try {
        emitter.updateControllerStatus('running');

        debug('[ControllerPhase] Resuming conversation with sessionId=%s', sessionId);
        await executeAgent(agentId, '', {
          workingDir: cwd,
          resumeSessionId: sessionId,
          resumePrompt: data.prompt,
          resumeMonitoringId: monitoringId,
        });

        // After response, go back to awaiting input
        emitter.updateControllerStatus('awaiting');
        emitter.setInputState({
          active: true,
          monitoringId,
        });
        debug('[ControllerPhase] Turn complete, waiting for next input');
      } catch (error) {
        debug('[ControllerPhase] Error during conversation: %s', (error as Error).message);
        cleanup();
        reject(error);
      }
    };

    // Handler for continue signal (Enter key in onboarding phase)
    const continueHandler = () => {
      debug('[ControllerPhase] Received controller-continue signal');
      cleanup();
      resolve();
    };

    // Cleanup function to remove listeners
    const cleanup = () => {
      (process as NodeJS.EventEmitter).off('workflow:input', inputHandler);
      (process as NodeJS.EventEmitter).off('workflow:controller-continue', continueHandler);
    };

    // Register listeners
    (process as NodeJS.EventEmitter).on('workflow:input', inputHandler);
    (process as NodeJS.EventEmitter).on('workflow:controller-continue', continueHandler);
  });
}
