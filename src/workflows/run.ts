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
} from '../shared/workflows/index.js';
import { StepIndexManager } from './indexing/index.js';
import { registry } from '../infra/engines/index.js';
import { MonitoringCleanup, AgentMonitorService, StatusService } from '../agents/monitoring/index.js';
import { WorkflowEventBus, WorkflowEventEmitter } from './events/index.js';
import { ensureWorkspaceStructure, mirrorSubAgents } from '../runtime/services/workspace/index.js';
import { WorkflowRunner } from './runner/index.js';
import { getUniqueAgentId } from './context/index.js';
import { setupWorkflowMCP, cleanupWorkflowMCP } from './mcp.js';
import { runControllerView } from './controller.js';

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
  const workflowAgents = Array.from(
    template.steps
      .filter((step) => step.type === 'module')
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
      }, new Map<string, { id: string; model?: unknown; modelReasoningEffort?: unknown }>()).values(),
  );

  if (workflowAgents.length > 0) {
    const engines = registry.getAll();
    for (const engine of engines) {
      if (engine.syncConfig) {
        await engine.syncConfig({ additionalAgents: workflowAgents });
      }
    }
  }

  // Get event bus
  // @ts-expect-error - global export from app.tsx
  const eventBus: WorkflowEventBus = globalThis.__workflowEventBus ?? new WorkflowEventBus();
  const emitter = new WorkflowEventEmitter(eventBus);

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

  // Filter steps by track and conditions
  debug('[Workflow] Filtering %d template steps...', template.steps.length);
  const visibleSteps = template.steps.filter((step, idx) => {
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

  // Count module steps for total
  const moduleSteps = visibleSteps.filter(s => s.type === 'module');

  // Initialize index manager with start index
  indexManager.setCurrentStepIndex(startIndex);

  // Run controller view FIRST if needed (blocks until controller done + user confirms)
  // Timeline population happens AFTER controller view since it's only visible in executing view
  const controllerResult = await runControllerView({
    cwd,
    cmRoot,
    template,
    emitter,
    eventBus,
  });

  // If controller ran, adjust start index to skip the controller agent step
  let actualStartIndex = startIndex;
  if (controllerResult.ran && startIndex === 0 && moduleSteps.length > 0) {
    const firstStep = moduleSteps[0];
    // Only skip if the first step is the controller agent
    if (firstStep.agentId === controllerResult.agentId) {
      debug('[Workflow] Controller view ran, skipping step 0 (controller agent: %s)', controllerResult.agentId);
      actualStartIndex = 1;
      // Mark step 0 as completed in the index manager
      indexManager.setCurrentStepIndex(1);
      await indexManager.stepCompleted(0);
    }
  }

  // NOW emit workflow started and populate timeline (after controller view is done)
  // This ensures timeline only appears when switching to executing view
  emitter.workflowStarted(template.name, moduleSteps.length);

  // Pre-populate timeline
  debug('[Workflow] ========== TIMELINE POPULATION ==========');
  debug('[Workflow] startIndex=%d, actualStartIndex=%d, total moduleSteps=%d', startIndex, actualStartIndex, moduleSteps.length);
  let moduleIndex = 0;
  for (let stepIndex = 0; stepIndex < visibleSteps.length; stepIndex++) {
    const step = visibleSteps[stepIndex];
    if (step.type === 'module') {
      const defaultEngine = registry.getDefault();
      const engineType = step.engine ?? defaultEngine?.metadata.id ?? 'unknown';
      const uniqueAgentId = getUniqueAgentId(step, moduleIndex);
      // Use actualStartIndex to account for controller agent being skipped
      const isCompleted = moduleIndex < actualStartIndex;

      // Resolve model from step or engine default
      const engineModule = registry.get(engineType);
      const resolvedModel = step.model ?? engineModule?.metadata.defaultModel;

      debug('[Workflow] Module %d (step %d): agentId=%s, isCompleted=%s (moduleIndex %d < actualStartIndex %d = %s)',
        moduleIndex, stepIndex, step.agentId, isCompleted, moduleIndex, actualStartIndex, moduleIndex < actualStartIndex);

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
        // For controller agent (step 0), use the monitoringId from controller result
        if (moduleIndex === 0 && controllerResult.ran && controllerResult.monitoringId !== undefined) {
          emitter.registerMonitoringId(uniqueAgentId, controllerResult.monitoringId);
          debug('[Workflow] Registered controller monitoringId=%d for step 0 (%s)', controllerResult.monitoringId, uniqueAgentId);
        } else {
          const stepData = await indexManager.getStepData(moduleIndex);
          debug('[Workflow] Module %d marked completed, stepData=%O', moduleIndex, stepData);
          if (stepData?.monitoringId !== undefined) {
            emitter.registerMonitoringId(uniqueAgentId, stepData.monitoringId);
          }
        }
      }

      moduleIndex++;
    } else if (step.type === 'separator') {
      emitter.addSeparator(step.text, stepIndex);
    }
  }
  debug('[Workflow] Timeline populated: %d completed, %d pending',
    actualStartIndex, moduleSteps.length - actualStartIndex);
  debug('[Workflow] ========== END STEP DECISION ==========');

  // Create and run workflow
  const runner = new WorkflowRunner({
    cwd,
    cmRoot,
    template: { ...template, steps: visibleSteps },
    emitter,
    startIndex: actualStartIndex,
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
