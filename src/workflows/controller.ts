/**
 * Controller View
 *
 * Runs the controller agent before workflow steps begin.
 * Sets view='controller' with autonomousMode='never' for pre-workflow conversation,
 * then transitions to view='executing' with autonomousMode='true'.
 */

import type { WorkflowTemplate } from './templates/types.js';
import type { WorkflowEventBus } from './events/event-bus.js';
import type { WorkflowEventEmitter } from './events/emitter.js';
import { initControllerAgent } from '../shared/workflows/controller.js';
import { loadControllerConfig, setAutonomousMode } from './controller/config.js';
import { setControllerView } from '../shared/workflows/template.js';
import { isControllerDefinition } from '../shared/workflows/controller-helper.js';
import { collectAgentDefinitions } from '../shared/agents/discovery/catalog.js';
import { debug } from '../shared/logging/logger.js';
import { formatUserInput } from '../shared/formatters/outputMarkers.js';
import { AgentLoggerService } from '../agents/monitoring/index.js';
import { executeAgent } from '../agents/runner/runner.js';

export interface ControllerViewOptions {
  cwd: string;
  cmRoot: string;
  template: WorkflowTemplate;
  emitter: WorkflowEventEmitter;
  eventBus: WorkflowEventBus;
}

export interface ControllerViewResult {
  /** Whether controller view ran (false if skipped) */
  ran: boolean;
  /** Controller agent ID if ran */
  agentId?: string;
  /** Monitoring ID for log viewing */
  monitoringId?: number;
}

/**
 * Run the controller view if needed.
 *
 * This function:
 * 1. Checks if controller is defined via controller() function
 * 2. Checks if controller session already exists (skip if so)
 * 3. Sets autonomousMode='never' and view='controller'
 * 4. Initializes and runs the controller agent conversation
 * 5. Waits for user to press Enter to continue
 * 6. Sets autonomousMode='true' and view='executing'
 *
 * @returns Result indicating if controller ran
 */
export async function runControllerView(
  options: ControllerViewOptions
): Promise<ControllerViewResult> {
  const { cwd, cmRoot, template, emitter, eventBus } = options;

  debug('[ControllerView] Starting controller view check');

  // Check if template has controller definition
  if (!template.controller || !isControllerDefinition(template.controller)) {
    debug('[ControllerView] Template does not have controller definition, skipping');
    return { ran: false };
  }

  const definition = template.controller;
  debug('[ControllerView] Controller definition found: %s', definition.agentId);

  // Check if controller session already exists
  const existingConfig = await loadControllerConfig(cmRoot);
  if (existingConfig?.controllerConfig?.sessionId) {
    debug('[ControllerView] Controller session already exists, skipping init');
    // Transition to executing view with autonomous mode
    await setAutonomousMode(cmRoot, 'true');
    await setControllerView(cmRoot, false);
    emitter.setWorkflowView('executing');
    return { ran: false };
  }

  // Find the controller agent from available agents
  const allAgents = await collectAgentDefinitions(cwd);
  const controller = allAgents.find(a => a.id === definition.agentId);
  if (!controller) {
    debug('[ControllerView] Controller agent not found: %s', definition.agentId);
    throw new Error(`Controller agent not found: ${definition.agentId}`);
  }

  debug('[ControllerView] Using controller agent: %s', controller.id);

  // Set autonomous mode to 'never' for controller conversation view
  debug('[ControllerView] Setting autonomousMode to never for controller conversation');
  await setAutonomousMode(cmRoot, 'never');

  // Set view to controller
  debug('[ControllerView] Setting view to controller');
  await setControllerView(cmRoot, true);
  emitter.setWorkflowView('controller');
  emitter.updateControllerStatus('running');

  // Get prompt path from controller definition
  const promptPath = controller.promptPath as string | string[] | undefined;
  if (!promptPath) {
    debug('[ControllerView] Controller has no prompt path, skipping');
    emitter.updateControllerStatus('failed');
    await setAutonomousMode(cmRoot, 'true');
    await setControllerView(cmRoot, false);
    emitter.setWorkflowView('executing');
    return { ran: false };
  }

  // Initialize controller agent
  // Engine/model resolution happens inside executeAgent (single source of truth)
  // Only pass overrides from workflow definition.options
  debug('[ControllerView] Initializing controller agent');
  let controllerMonitoringId: number | undefined;

  try {
    const config = await initControllerAgent(
      controller.id,
      promptPath,
      cwd,
      cmRoot,
      {
        onMonitoringId: (monitoringId) => {
          debug('[ControllerView] Controller monitoring ID: %d', monitoringId);
          controllerMonitoringId = monitoringId;
          emitter.registerControllerMonitoring(monitoringId);
        },
        engineOverride: definition.options?.engine,
        modelOverride: definition.options?.model,
      }
    );

    debug('[ControllerView] Controller initialized: sessionId=%s, monitoringId=%d, engine=%s, model=%s',
      config.sessionId, controllerMonitoringId, config.engine, config.model);

    // Emit controller info for UI (use resolved values from initControllerAgent)
    const controllerName = (controller.name as string | undefined) ?? controller.id;
    emitter.setControllerInfo(
      controller.id,
      controllerName,
      config.engine,
      config.model
    );

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

    debug('[ControllerView] Input state set, starting conversation loop');

    // Inlined conversation loop (replaces runControllerConversation)
    await new Promise<void>((resolve, reject) => {
      const controllerConfig = {
        agentId: controller.id,
        sessionId: config.sessionId,
        monitoringId: controllerMonitoringId!,
      };

      const cleanup = () => {
        ;(process as NodeJS.EventEmitter).off('workflow:input', onInput)
        ;(process as NodeJS.EventEmitter).off('workflow:controller-continue', onContinue)
      };

      const onInput = async (data: { prompt?: string; skip?: boolean }) => {
        debug('[ControllerView] Received input: prompt="%s" skip=%s',
          data.prompt?.slice(0, 50) ?? '(empty)', data.skip ?? false);

        // Skip signal means user wants to end controller view
        if (data.skip) {
          debug('[ControllerView] Skip signal - ending conversation');
          cleanup();
          resolve();
          return;
        }

        // Empty prompt means user is done
        if (!data.prompt || data.prompt.trim() === '') {
          debug('[ControllerView] Empty prompt - ending conversation');
          cleanup();
          resolve();
          return;
        }

        // Run conversation turn
        emitter.updateControllerStatus('running');
        emitter.setInputState(null);

        try {
          // Log input and execute agent (inlined from runTurn)
          // Engine/model resolved internally by executeAgent from agentConfig
          const formatted = formatUserInput(data.prompt);
          AgentLoggerService.getInstance().write(controllerConfig.monitoringId, `\n${formatted}\n`);

          await executeAgent(controllerConfig.agentId, data.prompt, {
            workingDir: cwd,
            resumeSessionId: controllerConfig.sessionId,
            resumePrompt: data.prompt,
            resumeMonitoringId: controllerConfig.monitoringId,
          });

          // After response, go back to awaiting input
          emitter.updateControllerStatus('awaiting');
          emitter.setInputState({
            active: true,
            monitoringId: controllerConfig.monitoringId,
          });
          debug('[ControllerView] Turn complete, waiting for next input');
        } catch (error) {
          debug('[ControllerView] Error during conversation: %s', (error as Error).message);
          cleanup();
          reject(error);
        }
      };

      const onContinue = () => {
        debug('[ControllerView] Received controller-continue signal');
        cleanup();
        resolve();
      };

      ;(process as NodeJS.EventEmitter).on('workflow:input', onInput);
      ;(process as NodeJS.EventEmitter).on('workflow:controller-continue', onContinue);
    });

    debug('[ControllerView] Conversation loop ended, transitioning to executing view');

    // Clear input state and switch to executing view
    emitter.setInputState(null);
    emitter.updateControllerStatus('completed');

    // Transition to autonomous mode for workflow execution
    debug('[ControllerView] Transitioning to autonomousMode=true for workflow execution');
    await setAutonomousMode(cmRoot, 'true');
    await setControllerView(cmRoot, false);

    emitter.setWorkflowView('executing');

    return { ran: true, agentId: controller.id, monitoringId: controllerMonitoringId };
  } catch (error) {
    debug('[ControllerView] Controller view failed: %s', (error as Error).message);
    emitter.setInputState(null);
    emitter.updateControllerStatus('failed');
    await setAutonomousMode(cmRoot, 'true');
    await setControllerView(cmRoot, false);
    emitter.setWorkflowView('executing');
    throw error;
  }
}

