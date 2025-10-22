import * as path from 'node:path';
import type { EngineType } from '../../infra/engines/index.js';
import { getEngine, registry } from '../../infra/engines/index.js';
import { loadAgentConfig, loadAgentTemplate } from '../../agents/execution/index.js';
import { MemoryAdapter } from '../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../../agents/index.js';
import { formatAgentLog } from '../../shared/logging/index.js';
import { processPromptString } from '../../shared/prompts/index.js';
import type { WorkflowUIManager } from '../../ui/index.js';
import { parseTelemetryChunk } from '../../ui/index.js';
import { AgentMonitorService, AgentLoggerService } from '../../agents/monitoring/index.js';

export interface TriggerExecutionOptions {
  triggerAgentId: string;
  cwd: string;
  engineType: EngineType;
  logger: (chunk: string) => void;
  stderrLogger: (chunk: string) => void;
  sourceAgentId: string; // The agent that triggered this execution
  ui?: WorkflowUIManager;
  abortSignal?: AbortSignal;
  /** Disable monitoring (for special cases) */
  disableMonitoring?: boolean;
}

/**
 * Executes a triggered agent by loading it from config/main.agents.js
 * This bypasses the workflow and allows triggering any agent, even outside the workflow
 */
export async function executeTriggerAgent(options: TriggerExecutionOptions): Promise<void> {
  const { triggerAgentId, cwd, engineType, logger, stderrLogger, sourceAgentId, ui, abortSignal, disableMonitoring } = options;

  // Initialize monitoring (unless explicitly disabled) - declare outside try for catch block access
  const monitor = !disableMonitoring ? AgentMonitorService.getInstance() : null;
  const loggerService = !disableMonitoring ? AgentLoggerService.getInstance() : null;
  let monitoringAgentId: number | undefined;

  try {
    // Load agent config and template from config/main.agents.js
    const triggeredAgentConfig = await loadAgentConfig(triggerAgentId, cwd);
    const rawTemplate = await loadAgentTemplate(triggerAgentId, cwd);
    const triggeredAgentTemplate = await processPromptString(rawTemplate, cwd);

    // Find parent agent in monitoring system by sourceAgentId
    let parentMonitoringId: number | undefined;
    if (monitor) {
      const parentAgents = monitor.queryAgents({ name: sourceAgentId });
      if (parentAgents.length > 0) {
        // Get the most recent one (highest ID)
        parentMonitoringId = parentAgents.sort((a, b) => b.id - a.id)[0].id;
      }

      // Register triggered agent with parent relationship
      monitoringAgentId = monitor.register({
        name: triggerAgentId,
        prompt: `Triggered by ${sourceAgentId}`,
        parentId: parentMonitoringId
      });
    }

    // Add triggered agent to UI
    if (ui) {
      const engineName = engineType; // preserve original engine type, even if unknown
      ui.addTriggeredAgent(sourceAgentId, {
        id: triggerAgentId,
        name: triggeredAgentConfig.name ?? triggerAgentId,
        engine: engineName,
        status: 'running',
        triggeredBy: sourceAgentId,
        startTime: Date.now(),
        telemetry: { tokensIn: 0, tokensOut: 0 },
        toolCount: 0,
        thinkingCount: 0,
      });
    }

    if (ui) {
      ui.logMessage(sourceAgentId, `Executing triggered agent: ${triggeredAgentConfig.name ?? triggerAgentId}`);
      ui.logMessage(triggerAgentId, '═'.repeat(80));
      ui.logMessage(triggerAgentId, `${triggeredAgentConfig.name ?? triggerAgentId} started to work (triggered).`);
    }

    // Build prompt for triggered agent (memory write-only, no read)
    const memoryDir = path.resolve(cwd, '.codemachine', 'memory');
    const adapter = new MemoryAdapter(memoryDir);
    const store = new MemoryStore(adapter);
    const compositePrompt = `[SYSTEM]\n${triggeredAgentTemplate}`;

    // Get engine and resolve model/reasoning
    const engine = getEngine(engineType);
    const engineModule = registry.get(engineType);
    const triggeredModel = (triggeredAgentConfig.model as string | undefined) ?? engineModule?.metadata.defaultModel;
    const triggeredReasoning = (triggeredAgentConfig.modelReasoningEffort as 'low' | 'medium' | 'high' | undefined) ?? engineModule?.metadata.defaultModelReasoningEffort;

    // Execute triggered agent
    let totalTriggeredStdout = '';
    const triggeredResult = await engine.run({
      prompt: compositePrompt,
      workingDir: cwd,
      model: triggeredModel,
      modelReasoningEffort: triggeredReasoning,
      onData: (chunk) => {
        totalTriggeredStdout += chunk;

        // Write to log file only (UI reads from log file)
        if (loggerService && monitoringAgentId !== undefined) {
          loggerService.write(monitoringAgentId, chunk);
        }
      },
      onErrorData: (chunk) => {
        // Write stderr to log file only (UI reads from log file)
        if (loggerService && monitoringAgentId !== undefined) {
          loggerService.write(monitoringAgentId, `[STDERR] ${chunk}`);
        }
      },
      onTelemetry: (telemetry) => {
        ui?.updateAgentTelemetry(triggerAgentId, telemetry);

        // Update telemetry in monitoring
        if (monitor && monitoringAgentId !== undefined) {
          monitor.updateTelemetry(monitoringAgentId, telemetry);
        }
      },
      abortSignal,
    });

    // Fallback: parse telemetry from final output if not captured via stream
    if (ui) {
      const finalTelemetry = parseTelemetryChunk(totalTriggeredStdout);
      if (finalTelemetry) {
        ui.updateAgentTelemetry(triggerAgentId, finalTelemetry);
      }
    }

    // Store output in memory
    const triggeredStdout = triggeredResult.stdout || totalTriggeredStdout;
    const triggeredSlice = triggeredStdout.slice(-2000);
    await store.append({
      agentId: triggerAgentId,
      content: triggeredSlice,
      timestamp: new Date().toISOString(),
    });

    // Update UI status on completion
    if (ui) {
      // Always mark as completed (no failed status)
      ui.updateAgentStatus(triggerAgentId, 'completed');
    }

    if (ui) {
      ui.logMessage(triggerAgentId, `${triggeredAgentConfig.name ?? triggerAgentId} (triggered) has completed their work.`);
      ui.logMessage(triggerAgentId, '═'.repeat(80));
    }

    // Mark agent as completed in monitoring
    if (monitor && monitoringAgentId !== undefined) {
      monitor.complete(monitoringAgentId);
      if (loggerService) {
        loggerService.closeStream(monitoringAgentId);
      }
    }
  } catch (triggerError) {
    // Mark agent as failed in monitoring
    if (monitor && monitoringAgentId !== undefined) {
      monitor.fail(monitoringAgentId, triggerError as Error);
      if (loggerService) {
        loggerService.closeStream(monitoringAgentId);
      }
    }

    // Don't update status to failed - let it stay as running/retrying
    console.error(
      formatAgentLog(
        sourceAgentId,
        `Triggered agent '${triggerAgentId}' failed: ${triggerError instanceof Error ? triggerError.message : String(triggerError)}`,
      ),
    );
    // Continue with workflow even if triggered agent fails
    throw triggerError;
  }
}
