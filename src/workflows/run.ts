/**
 * Workflow Runner Entry Point
 *
 * Architecture:
 * - State machine for state management
 * - Input providers for input sources
 * - Clean separation of concerns
 */

import * as path from 'node:path';

import type { RunWorkflowOptions, WorkflowStep, WorkflowTemplate } from './templates/types.js';
import { loadTemplateWithPath } from './templates/index.js';
import { debug, setDebugLogFile } from '../shared/logging/logger.js';
import {
  getTemplatePathFromTracking,
  getSelectedTrack,
  getSelectedConditions,
  getControllerAgents,
  initControllerAgent,
} from '../shared/workflows/index.js';
import { isModuleStep } from './templates/types.js';
import { StepIndexManager } from './indexing/index.js';
import { registry } from '../infra/engines/index.js';
import { MonitoringCleanup, AgentMonitorService, StatusService } from '../agents/monitoring/index.js';
import { WorkflowEventBus, WorkflowEventEmitter } from './events/index.js';
import { ensureWorkspaceStructure, mirrorSubAgents } from '../runtime/services/workspace/index.js';
import { WorkflowRunner } from './runner/index.js';
import { getUniqueAgentId } from './context/index.js';
import { setupWorkflowMCP, cleanupWorkflowMCP } from './mcp.js';

// Re-export from preflight for backward compatibility
export { ValidationError, checkWorkflowCanStart, checkSpecificationRequired, checkOnboardingRequired, needsOnboarding } from './preflight.js';
export type { WorkflowStep, WorkflowTemplate };

/**
 * Run a workflow
 * Note: Pre-flight checks (specification validation) should be done via preflight.ts before calling this
 */
export async function runWorkflow(options: RunWorkflowOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

  // Ensure workspace structure exists (creates .codemachine folder tree)
  await ensureWorkspaceStructure({ cwd });

  // Load template
  const cmRoot = path.join(cwd, '.codemachine');
  const templatePath = options.templatePath || (await getTemplatePathFromTracking(cmRoot));
  const { template } = await loadTemplateWithPath(cwd, templatePath);

  // Clear screen for TUI
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H');
  }

  // Redirect debug logs to file
  const rawLogLevel = (process.env.LOG_LEVEL || '').trim().toLowerCase();
  const debugFlag = (process.env.DEBUG || '').trim().toLowerCase();
  const debugEnabled = rawLogLevel === 'debug' || (debugFlag !== '' && debugFlag !== '0' && debugFlag !== 'false');
  const debugLogPath = debugEnabled ? path.join(cwd, '.codemachine', 'logs', 'workflow-debug.log') : null;
  setDebugLogFile(debugLogPath);

  // Set up cleanup handlers
  MonitoringCleanup.setup();

  // Initialize index manager for step tracking
  const indexManager = new StepIndexManager(cmRoot);

  // Register callback to save session state before cleanup on Ctrl+C
  // This ensures session/monitoring IDs are persisted even if the first turn hasn't completed
  MonitoringCleanup.registerWorkflowHandlers({
    onBeforeCleanup: async () => {
      const monitor = AgentMonitorService.getInstance();
      const activeAgents = monitor.getActiveAgents();

      // Find root agents (no parentId) - these are the main step agents
      const rootAgents = activeAgents.filter((agent) => !agent.parentId);

      for (const agent of rootAgents) {
        // Only save if agent has a sessionId (needed for resume)
        if (agent.sessionId) {
          const stepIndex = indexManager.currentStepIndex;
          debug('[Workflow] Saving session state on Ctrl+C: step=%d, sessionId=%s, monitoringId=%d',
            stepIndex, agent.sessionId, agent.id);
          await indexManager.stepSessionInitialized(stepIndex, agent.sessionId, agent.id);
        }
      }
    },
  });

  debug('[Workflow] Using template: %s', template.name);

  // Mirror sub-agents if template has subAgentIds
  if (template.subAgentIds && template.subAgentIds.length > 0) {
    debug('[Workflow] Mirroring %d sub-agents', template.subAgentIds.length);
    await mirrorSubAgents({ cwd, subAgentIds: template.subAgentIds });
  }

  // Setup MCP servers for workflow signal tools (use cwd for project root settings)
  const mcpResult = await setupWorkflowMCP(template, cwd);
  if (mcpResult.configured.length > 0) {
    debug('[Workflow] MCP configured for engines: %s', mcpResult.configured.join(', '));
  }
  if (mcpResult.failed.length > 0) {
    debug('[Workflow] MCP setup failed for engines: %s', mcpResult.failed.join(', '));
  }

  // Sync agent configurations
  const moduleStepsForSync = template.steps.filter(
    (step): step is import('./templates/types.js').ModuleStep => step.type === 'module'
  );
  const workflowAgents = Array.from(
    moduleStepsForSync
      .reduce((acc, step) => {
        const id = step.agentId?.trim();
        if (!id) return acc;
        const existing = acc.get(id) ?? { id };
        acc.set(id, {
          ...existing,
          id,
          model: step.model ?? existing.model,
          modelReasoningEffort: step.modelReasoningEffort ?? existing.modelReasoningEffort,
        });
        return acc;
      }, new Map<string, { id: string; model?: string; modelReasoningEffort?: string }>()).values(),
  );

  if (workflowAgents.length > 0) {
    const engines = registry.getAll();
    for (const engine of engines) {
      if (engine.syncConfig) {
        await engine.syncConfig({ additionalAgents: workflowAgents });
      }
    }
  }

  // Get event bus (prioritize explicitly passed instance)
  // @ts-expect-error - global export from app.tsx
  const eventBus: WorkflowEventBus = options.eventBus ?? globalThis.__workflowEventBus ?? new WorkflowEventBus();

  if (options.eventBus) {
    debug('[Workflow] Using explicitly passed EventBus');
  } else if ((globalThis as any).__workflowEventBus) {
    debug('[Workflow] Using global EventBus');
  } else {
    debug('[Workflow] Created new EventBus (Warning: might be disconnected from UI)');
  }

  // Enable history to handle race conditions where UI connects late

  const emitter = new WorkflowEventEmitter(eventBus);

  // Enable history to ensure early events (like workflow:started and agent:added)
  // are received by the TUI adapter when it connects later
  eventBus.enableHistory();

  // @ts-expect-error - global export
  if (!globalThis.__workflowEventBus) {
    // @ts-expect-error - global export
    globalThis.__workflowEventBus = eventBus;
  }

  // Initialize status coordinator
  const status = StatusService.getInstance();
  status.setEmitter(emitter);

  // Get resume info
  const resumeInfo = await indexManager.getResumeInfo();
  const startIndex = resumeInfo.startIndex;
  debug('[Workflow] ========== STEP DECISION ==========');
  debug('[Workflow] Resume info: startIndex=%d, decision=%s', startIndex, resumeInfo.decision);

  // Load track and conditions selections
  const selectedTrack = await getSelectedTrack(cmRoot);
  const selectedConditions = await getSelectedConditions(cmRoot);
  debug('[Workflow] selectedTrack: %s', selectedTrack);
  debug('[Workflow] selectedConditions: %O', selectedConditions);

  // Inject controller step if present
  // This ensures the controller conversation happens as the first step (Step 0)
  // The indexManager will handle skipping it if already completed (resumed)
  const stepsToRun = [...template.steps];

  if (template.controller) {
    let controllerStep: import('./templates/types.js').ModuleStep | undefined;

    // Check if it's an object with type 'controller' (fuzzy check instead of isModuleStep)
    const isControllerObj = typeof template.controller === 'object' &&
      template.controller !== null &&
      (template.controller as any).type === 'controller';

    if (isControllerObj || isModuleStep(template.controller as any)) {
      // New format: controller() function returning ModuleStep
      controllerStep = {
        ...template.controller as any,
        type: 'controller', // Ensure type is set
        interactive: true, // Always interactive
      };
    } else if (template.controller === true) {
      // Legacy format: boolean true
      // Find the first available controller agent
      const controllers = await getControllerAgents(cwd);
      if (controllers.length > 0) {
        const agent = controllers[0];
        controllerStep = {
          type: 'controller',
          agentId: agent.id as string,
          agentName: (agent.name || agent.id) as string,
          promptPath: (agent.promptPath as string | string[]) || '',
          interactive: true,
        };
        debug('[Workflow] Legacy controller: true resolved to agent %s', agent.id);
      } else {
        debug('[Workflow] Warning: controller: true requested but no controller agents found');
      }
    }

    if (controllerStep) {
      // Initialize controller session (saves to template.json)
      // We start in manual mode so the conversation happens interactively
      debug('[Workflow] Initializing controller agent %s', controllerStep.agentId);
      await initControllerAgent(
        controllerStep.agentId,
        controllerStep.promptPath,
        cwd,
        cmRoot,
        { initialAutonomousMode: false }
      );

      // Detect and remove duplicate controller step from the main steps list
      // This handles the edge case where user defined controller in both 'controller' and 'steps'
      const duplicateIndex = stepsToRun.findIndex(step =>
        isModuleStep(step) && step.agentId === controllerStep!.agentId
      );

      if (duplicateIndex !== -1) {
        debug('[Workflow] Removed duplicate controller step from steps list at index %d', duplicateIndex);
        stepsToRun.splice(duplicateIndex, 1);
      }

      debug('[Workflow] Injecting controller step: %s', controllerStep.agentId);
      stepsToRun.unshift(controllerStep as WorkflowStep);
    }
  }

  // Filter steps by track and conditions
  debug('[Workflow] Filtering %d template steps...', stepsToRun.length);
  const visibleSteps = stepsToRun.filter((step, idx) => {
    // Separators are always included (visual dividers only)
    if (step.type === 'separator') {
      debug('[Workflow] Step %d: type=separator → included (visual separator)', idx);
      return true;
    }
    // Module steps may be filtered by track/conditions
    if (step.tracks?.length && selectedTrack && !step.tracks.includes(selectedTrack)) {
      debug('[Workflow] Step %d: agentId=%s, tracks=%O, selectedTrack=%s → EXCLUDED (track mismatch)',
        idx, step.agentId, step.tracks, selectedTrack);
      return false;
    }
    if (step.conditions?.length) {
      const missing = step.conditions.filter(c => !(selectedConditions ?? []).includes(c));
      if (missing.length > 0) {
        debug('[Workflow] Step %d: agentId=%s, conditions=%O, missing=%O → EXCLUDED (missing conditions)',
          idx, step.agentId, step.conditions, missing);
        return false;
      }
    }
    debug('[Workflow] Step %d: agentId=%s → included', idx, step.agentId);
    return true;
  });
  debug('[Workflow] Visible steps after filtering: %d', visibleSteps.length);

  // Count module steps for total (including controller)
  const moduleSteps = visibleSteps.filter(s => s.type === 'module' || s.type === 'controller');

  // Find controller agent ID for the TUI (if present)
  const controllerStep = visibleSteps.find(s => s.type === 'controller');
  const controllerAgentId = controllerStep && isModuleStep(controllerStep) ? controllerStep.agentId : undefined;

  // Emit workflow started (with controller ID if present)
  debug('[Workflow] Emitting workflow:started: name=%s, totalSteps=%d, controllerId=%s', template.name, moduleSteps.length, controllerAgentId ?? '(none)');
  emitter.workflowStarted(template.name, moduleSteps.length, controllerAgentId);

  // Pre-populate timeline
  debug('[Workflow] ========== TIMELINE POPULATION ==========');
  debug('[Workflow] startIndex=%d, total moduleSteps=%d', startIndex, moduleSteps.length);
  let moduleIndex = 0;
  for (let stepIndex = 0; stepIndex < visibleSteps.length; stepIndex++) {
    const step = visibleSteps[stepIndex];
    if (step.type === 'module' || step.type === 'controller') {
      const defaultEngine = registry.getDefault();
      const engineType = step.engine ?? defaultEngine?.metadata.id ?? 'unknown';
      const uniqueAgentId = getUniqueAgentId(step, moduleIndex);
      const isCompleted = moduleIndex < startIndex;

      debug('[Workflow] Emitting agent:added: index=%d, uniqueId=%s, name=%s', moduleIndex, uniqueAgentId, step.agentName);

      // Resolve model from step or engine default
      const engineModule = registry.get(engineType);
      const resolvedModel = step.model ?? engineModule?.metadata.defaultModel;

      debug('[Workflow] Module %d (step %d): agentId=%s, isCompleted=%s (moduleIndex %d < startIndex %d = %s)',
        moduleIndex, stepIndex, step.agentId, isCompleted, moduleIndex, startIndex, moduleIndex < startIndex);

      emitter.addMainAgent(
        uniqueAgentId,
        step.agentName ?? step.agentId,
        engineType,
        moduleIndex,
        moduleSteps.length,
        stepIndex, // orderIndex: overall step position for timeline ordering
        isCompleted ? 'completed' : 'pending',
        resolvedModel
      );

      // For completed agents, register their monitoringId from template.json
      if (isCompleted) {
        const stepData = await indexManager.getStepData(moduleIndex);
        debug('[Workflow] Module %d marked completed, stepData=%O', moduleIndex, stepData);
        if (stepData?.monitoringId !== undefined) {
          emitter.registerMonitoringId(uniqueAgentId, stepData.monitoringId);
        }
      }

      moduleIndex++;
    } else if (step.type === 'separator') {
      emitter.addSeparator(step.text, stepIndex);
    }
  }
  debug('[Workflow] Timeline populated: %d completed, %d pending',
    startIndex, moduleSteps.length - startIndex);
  debug('[Workflow] ========== END STEP DECISION ==========');

  // Initialize index manager with start index
  indexManager.setCurrentStepIndex(startIndex);

  // Create and run workflow
  const runner = new WorkflowRunner({
    cwd,
    cmRoot,
    template: { ...template, steps: visibleSteps },
    emitter,
    startIndex,
    indexManager,
    status,
  });

  // Cleanup function for MCP
  const doMCPCleanup = async () => {
    debug('[Workflow] Cleaning up MCP...');
    await cleanupWorkflowMCP(template, cwd).catch(() => { });
  };

  // Handle SIGINT (Ctrl+C) for cleanup
  const sigintHandler = async () => {
    await doMCPCleanup();
    process.exit(0);
  };
  process.once('SIGINT', sigintHandler);
  process.once('SIGTERM', sigintHandler);

  try {
    await runner.run();
  } catch (error) {
    debug('[Workflow] Error: %s', (error as Error).message);
    emitter.setWorkflowStatus('error');
    (process as NodeJS.EventEmitter).emit('workflow:error', {
      reason: (error as Error).message,
    });
    throw error;
  } finally {
    // Always cleanup MCP when workflow ends (success, error, or stop)
    process.off('SIGINT', sigintHandler);
    process.off('SIGTERM', sigintHandler);
    await doMCPCleanup();
  }

  // Keep process alive for TUI
  if (eventBus.hasSubscribers()) {
    await new Promise(() => {
      // Never resolves - Ctrl+C exits
    });
  }
}

export default runWorkflow;
