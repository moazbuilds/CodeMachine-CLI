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
import { MonitoringCleanup, AgentMonitorService } from '../agents/monitoring/index.js';
import { WorkflowEventBus, WorkflowEventEmitter } from './events/index.js';
import { validateSpecification } from '../runtime/services/index.js';
import { WorkflowRunner } from './runner/index.js';
import { getUniqueAgentId } from './context/index.js';
import { setupWorkflowMCP, cleanupWorkflowMCP } from './mcp.js';

export { validateSpecification, ValidationError } from '../runtime/services/index.js';
export type { WorkflowStep, WorkflowTemplate };

/**
 * Run a workflow with validation
 */
export async function runWorkflow(options: RunWorkflowOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const specificationPath = options.specificationPath || path.resolve(cwd, '.codemachine', 'inputs', 'specifications.md');

  // Validate specification
  await validateSpecification(specificationPath);

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

  // Load template (needed before we can set up the before-cleanup handler)
  const cmRoot = path.join(cwd, '.codemachine');
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

  // Load template
  const templatePath = options.templatePath || (await getTemplatePathFromTracking(cmRoot));
  const { template } = await loadTemplateWithPath(cwd, templatePath);

  debug('[Workflow] Using template: %s', template.name);

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

  // Emit workflow started
  emitter.workflowStarted(template.name, moduleSteps.length);

  // Pre-populate timeline
  debug('[Workflow] ========== TIMELINE POPULATION ==========');
  debug('[Workflow] startIndex=%d, total moduleSteps=%d', startIndex, moduleSteps.length);
  let moduleIndex = 0;
  for (let stepIndex = 0; stepIndex < visibleSteps.length; stepIndex++) {
    const step = visibleSteps[stepIndex];
    if (step.type === 'module') {
      const defaultEngine = registry.getDefault();
      const engineType = step.engine ?? defaultEngine?.metadata.id ?? 'unknown';
      const uniqueAgentId = getUniqueAgentId(step, moduleIndex);
      const isCompleted = moduleIndex < startIndex;

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
  });

  // Cleanup function for MCP
  const doMCPCleanup = async () => {
    debug('[Workflow] Cleaning up MCP...');
    await cleanupWorkflowMCP(template, cwd).catch(() => {});
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
