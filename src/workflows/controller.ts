/**
 * Controller Phase
 *
 * Runs the controller agent before workflow steps begin.
 * Sets phase='controller' with autonomousMode='never' for pre-workflow conversation,
 * then transitions to phase='executing' with autonomousMode='true'.
 */

import type { WorkflowTemplate } from './templates/types.js';
import type { WorkflowEventBus } from './events/event-bus.js';
import type { WorkflowEventEmitter } from './events/emitter.js';
import {
  initControllerAgent,
  loadControllerConfig,
  setAutonomousMode,
} from '../shared/workflows/controller.js';
import { isControllerDefinition } from '../shared/workflows/controller-helper.js';
import { collectAgentDefinitions } from '../shared/agents/discovery/catalog.js';
import { executeAgent } from '../agents/runner/runner.js';
import { AgentLoggerService } from '../agents/monitoring/index.js';
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
  /** Monitoring ID for log viewing */
  monitoringId?: number;
}

/**
 * Run the controller phase if needed.
 *
 * This function:
 * 1. Checks if controller is defined via controller() function
 * 2. Checks if controller session already exists (skip if so)
 * 3. Sets autonomousMode='never' and phase='controller'
 * 4. Initializes and runs the controller agent conversation
 * 5. Waits for user to press Enter to continue
 * 6. Sets autonomousMode='true' and phase='executing'
 *
 * @returns Result indicating if controller ran
 */
export async function runControllerPhase(
  options: ControllerPhaseOptions
): Promise<ControllerPhaseResult> {
  const { cwd, cmRoot, template, emitter, eventBus } = options;

  debug('[ControllerPhase] Starting controller phase check');

  // Check if template has controller definition
  if (!template.controller || !isControllerDefinition(template.controller)) {
    debug('[ControllerPhase] Template does not have controller definition, skipping');
    return { ran: false };
  }

  const definition = template.controller;
  debug('[ControllerPhase] Controller definition found: %s', definition.agentId);

  // Check if controller session already exists
  const existingConfig = await loadControllerConfig(cmRoot);
  if (existingConfig?.controllerConfig?.sessionId) {
    debug('[ControllerPhase] Controller session already exists, skipping init');
    // Transition to executing phase with autonomous mode
    await setAutonomousMode(cmRoot, 'true');
    emitter.setWorkflowView('executing');
    return { ran: false };
  }

  // Find the controller agent from available agents
  const allAgents = await collectAgentDefinitions(cwd);
  const controller = allAgents.find(a => a.id === definition.agentId);
  if (!controller) {
    debug('[ControllerPhase] Controller agent not found: %s', definition.agentId);
    throw new Error(`Controller agent not found: ${definition.agentId}`);
  }

  debug('[ControllerPhase] Using controller agent: %s', controller.id);

  // Resolve engine and model (definition options override agent config)
  const defaultEngine = registry.getDefault();
  const engineType = definition.options?.engine ?? controller.engine ?? defaultEngine?.metadata.id ?? 'claude';
  const engineModule = registry.get(engineType);
  const resolvedModel = definition.options?.model ?? controller.model ?? engineModule?.metadata.defaultModel;

  // Set autonomous mode to 'never' for controller conversation phase
  debug('[ControllerPhase] Setting autonomousMode to never for controller conversation');
  await setAutonomousMode(cmRoot, 'never');

  // Set view to controller
  debug('[ControllerPhase] Setting view to controller');
  emitter.setWorkflowView('controller');

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
    await setAutonomousMode(cmRoot, 'true');
    emitter.setWorkflowView('executing');
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

    // Transition to autonomous mode for workflow execution
    debug('[ControllerPhase] Transitioning to autonomousMode=true for workflow execution');
    await setAutonomousMode(cmRoot, 'true');

    emitter.setWorkflowView('executing');

    return { ran: true, agentId: controller.id, monitoringId: controllerMonitoringId };
  } catch (error) {
    debug('[ControllerPhase] Controller phase failed: %s', (error as Error).message);
    emitter.setInputState(null);
    emitter.updateControllerStatus('failed');
    await setAutonomousMode(cmRoot, 'true');
    emitter.setWorkflowView('executing');
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

        // Echo user input to log file so it's visible in the UI
        const loggerService = AgentLoggerService.getInstance();
        loggerService.write(monitoringId, `\n\n━━━ USER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${data.prompt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`);

        debug('[ControllerPhase] Resuming conversation with sessionId=%s', sessionId);
        await executeAgent(agentId, data.prompt, {
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
