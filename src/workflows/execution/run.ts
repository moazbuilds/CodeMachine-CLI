/**
 * Workflow Runner Entry Point
 *
 * Architecture:
 * - State machine for state management
 * - Input providers for input sources
 * - Clean separation of concerns
 */

import * as path from 'node:path';

import type { RunWorkflowOptions, WorkflowStep, WorkflowTemplate } from '../templates/types.js';
import { loadTemplateWithPath } from '../templates/index.js';
import { debug, setDebugLogFile } from '../../shared/logging/logger.js';
import {
  getTemplatePathFromTracking,
  getResumeStartIndex,
} from '../../shared/workflows/index.js';
import { registry } from '../../infra/engines/index.js';
import { MonitoringCleanup } from '../../agents/monitoring/index.js';
import { WorkflowEventBus, WorkflowEventEmitter } from '../events/index.js';
import { validateSpecification } from '../../runtime/services/index.js';
import { WorkflowRunner } from './runner.js';

export { validateSpecification, ValidationError } from '../../runtime/services/index.js';
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

  // Load template
  const cmRoot = path.join(cwd, '.codemachine');
  const templatePath = options.templatePath || (await getTemplatePathFromTracking(cmRoot));
  const { template } = await loadTemplateWithPath(cwd, templatePath);

  debug('[Workflow] Using template: %s', template.name);

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

  // Get start index
  const startIndex = await getResumeStartIndex(cmRoot);

  // Count module steps for total
  const moduleSteps = template.steps.filter(s => s.type === 'module');

  // Emit workflow started
  emitter.workflowStarted(template.name, moduleSteps.length);

  // Pre-populate timeline
  let moduleIndex = 0;
  template.steps.forEach((step, stepIndex) => {
    if (step.type === 'module') {
      const defaultEngine = registry.getDefault();
      const engineType = step.engine ?? defaultEngine?.metadata.id ?? 'unknown';
      const uniqueAgentId = `${step.agentId}-step-${moduleIndex}`;

      emitter.addMainAgent(
        uniqueAgentId,
        step.agentName ?? step.agentId,
        engineType,
        moduleIndex,
        moduleSteps.length,
        moduleIndex < startIndex ? 'completed' : 'pending',
        step.model
      );
      moduleIndex++;
    } else if (step.type === 'ui') {
      emitter.addUIElement(step.text, stepIndex);
    }
  });

  // Create and run workflow
  const runner = new WorkflowRunner({
    cwd,
    cmRoot,
    template,
    emitter,
    startIndex,
  });

  try {
    await runner.run();
  } catch (error) {
    debug('[Workflow] Error: %s', (error as Error).message);
    emitter.setWorkflowStatus('error');
    (process as NodeJS.EventEmitter).emit('workflow:error', {
      reason: (error as Error).message,
    });
    throw error;
  }

  // Keep process alive for TUI
  if (eventBus.hasSubscribers()) {
    await new Promise(() => {
      // Never resolves - Ctrl+C exits
    });
  }
}

export default runWorkflow;
