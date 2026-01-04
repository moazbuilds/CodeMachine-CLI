/**
 * Trigger Execution
 *
 * Executes a triggered agent by loading it from config/main.agents.js.
 * This bypasses the workflow and allows triggering any agent, even outside the workflow.
 */

import type { EngineType } from '../../../infra/engines/index.js';
import { getEngine, registry } from '../../../infra/engines/index.js';
import { loadAgentConfig, loadAgentTemplate } from '../../../agents/runner/index.js';
import { processPromptString } from '../../../shared/prompts/index.js';
import type { WorkflowEventEmitter } from '../../events/index.js';
import { AgentMonitorService, AgentLoggerService, StatusService } from '../../../agents/monitoring/index.js';

export interface TriggerExecutionOptions {
  triggerAgentId: string;
  cwd: string;
  engineType: EngineType;
  logger: (chunk: string) => void;
  stderrLogger: (chunk: string) => void;
  sourceAgentId: string;
  emitter?: WorkflowEventEmitter;
  abortSignal?: AbortSignal;
  disableMonitoring?: boolean;
}

/**
 * Executes a triggered agent
 */
export async function executeTriggerAgent(options: TriggerExecutionOptions): Promise<void> {
  const { triggerAgentId, cwd, engineType, sourceAgentId, emitter, abortSignal, disableMonitoring } = options;

  const monitor = !disableMonitoring ? AgentMonitorService.getInstance() : null;
  const loggerService = !disableMonitoring ? AgentLoggerService.getInstance() : null;
  let monitoringAgentId: number | undefined;

  try {
    const triggeredAgentConfig = await loadAgentConfig(triggerAgentId, cwd);
    const rawTemplate = await loadAgentTemplate(triggerAgentId, cwd);
    const triggeredAgentTemplate = await processPromptString(rawTemplate, cwd);

    const engine = getEngine(engineType);
    const engineModule = registry.get(engineType);
    const triggeredModel = (triggeredAgentConfig.model as string | undefined) ?? engineModule?.metadata.defaultModel;
    const triggeredReasoning = (triggeredAgentConfig.modelReasoningEffort as 'low' | 'medium' | 'high' | undefined) ?? engineModule?.metadata.defaultModelReasoningEffort;

    let parentMonitoringId: number | undefined;
    if (monitor) {
      const parentAgents = monitor.queryAgents({ name: sourceAgentId });
      if (parentAgents.length > 0) {
        parentMonitoringId = parentAgents.sort((a, b) => b.id - a.id)[0].id;
      }

      const promptText = `Triggered by ${sourceAgentId}`;
      monitoringAgentId = await monitor.register({
        name: triggerAgentId,
        prompt: promptText,
        parentId: parentMonitoringId,
        engineProvider: engineType,
        modelName: triggeredModel,
      });

      if (loggerService && monitoringAgentId !== undefined) {
        loggerService.storeFullPrompt(monitoringAgentId, promptText);
      }

      if (emitter && monitoringAgentId !== undefined) {
        emitter.registerMonitoringId(triggerAgentId, monitoringAgentId);
      }
    }

    const engineName = engineType;
    const triggeredAgentName = triggeredAgentConfig.name ?? triggerAgentId;
    const triggeredAgentData = {
      id: triggerAgentId,
      name: triggeredAgentName,
      engine: engineName,
      status: 'running' as const,
      triggeredBy: sourceAgentId,
      startTime: Date.now(),
      telemetry: { tokensIn: 0, tokensOut: 0 },
      toolCount: 0,
      thinkingCount: 0,
    };
    if (emitter) {
      emitter.addTriggeredAgent(sourceAgentId, triggeredAgentData);
    }

    const compositePrompt = triggeredAgentTemplate;

    let totalTriggeredStdout = '';
    const triggeredResult = await engine.run({
      prompt: compositePrompt,
      workingDir: cwd,
      model: triggeredModel,
      modelReasoningEffort: triggeredReasoning,
      onData: (chunk) => {
        totalTriggeredStdout += chunk;
        if (loggerService && monitoringAgentId !== undefined) {
          loggerService.write(monitoringAgentId, chunk);
        }
      },
      onErrorData: (chunk) => {
        if (loggerService && monitoringAgentId !== undefined) {
          loggerService.write(monitoringAgentId, `[STDERR] ${chunk}`);
        }
      },
      onTelemetry: (telemetry) => {
        emitter?.updateAgentTelemetry(triggerAgentId, telemetry);
        if (monitor && monitoringAgentId !== undefined) {
          monitor.updateTelemetry(monitoringAgentId, telemetry).catch(err =>
            console.error(`Failed to update telemetry: ${err}`)
          );
        }
      },
      abortSignal,
    });

    // Use StatusService for coordinated DB + UI updates
    if (monitoringAgentId !== undefined) {
      const status = StatusService.getInstance();
      status.register(monitoringAgentId, triggerAgentId);
      await status.complete(monitoringAgentId);
    } else {
      // No monitoring - just update UI
      const status = StatusService.getInstance();
      status.completed(triggerAgentId);
    }
  } catch (triggerError) {
    if (monitor && monitoringAgentId !== undefined) {
      const status = StatusService.getInstance();
      status.register(monitoringAgentId, triggerAgentId);
      const agent = monitor.getAgent(monitoringAgentId);
      if (agent?.sessionId) {
        // Agent has sessionId = resumable → mark as paused
        await status.pause(monitoringAgentId);
      } else {
        // No sessionId = can't resume → mark as failed
        await status.fail(monitoringAgentId, triggerError as Error);
      }
    }
    throw triggerError;
  }
}
