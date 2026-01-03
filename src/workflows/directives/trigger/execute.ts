/**
 * Trigger Execution
 *
 * Executes a triggered agent by loading it from config/main.agents.js.
 * This bypasses the workflow and allows triggering any agent, even outside the workflow.
 */

import * as path from 'node:path';
import type { EngineType } from '../../../infra/engines/index.js';
import { getEngine, registry } from '../../../infra/engines/index.js';
import { loadAgentConfig, loadAgentTemplate } from '../../../agents/runner/index.js';
import { MemoryAdapter } from '../../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../../../agents/index.js';
import { processPromptString } from '../../../shared/prompts/index.js';
import type { WorkflowEventEmitter } from '../../events/index.js';
import { AgentMonitorService, AgentLoggerService } from '../../../agents/monitoring/index.js';

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

    const memoryDir = path.resolve(cwd, '.codemachine', 'memory');
    const adapter = new MemoryAdapter(memoryDir);
    const store = new MemoryStore(adapter);
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

    const triggeredStdout = triggeredResult.stdout || totalTriggeredStdout;
    const triggeredSlice = triggeredStdout.slice(-2000);
    await store.append({
      agentId: triggerAgentId,
      content: triggeredSlice,
      timestamp: new Date().toISOString(),
    });

    if (emitter) {
      emitter.updateAgentStatus(triggerAgentId, 'completed');
    }

    if (monitor && monitoringAgentId !== undefined) {
      await monitor.complete(monitoringAgentId);
    }
  } catch (triggerError) {
    if (monitor && monitoringAgentId !== undefined) {
      const agent = monitor.getAgent(monitoringAgentId);
      if (agent?.sessionId) {
        // Agent has sessionId = resumable → mark as paused
        await monitor.markPaused(monitoringAgentId);
      } else {
        // No sessionId = can't resume → mark as failed
        await monitor.fail(monitoringAgentId, triggerError as Error);
      }
    }
    throw triggerError;
  }
}
