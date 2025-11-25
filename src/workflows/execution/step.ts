import * as path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import type { WorkflowStep } from '../templates/index.js';
import { isModuleStep } from '../templates/types.js';
import type { EngineType } from '../../infra/engines/index.js';
import { processPromptString } from '../../shared/prompts/index.js';
import { executeAgent } from '../../agents/runner/runner.js';
import type { WorkflowUIManager } from '../../ui/index.js';
import type { WorkflowEventEmitter } from '../events/emitter.js';

export interface StepExecutorOptions {
  logger: (chunk: string) => void;
  stderrLogger: (chunk: string) => void;
  timeout?: number;
  ui?: WorkflowUIManager;
  emitter?: WorkflowEventEmitter;
  abortSignal?: AbortSignal;
  /** Parent agent ID for tracking relationships */
  parentId?: number;
  /** Disable monitoring (for special cases) */
  disableMonitoring?: boolean;
  /** Unique agent ID for UI updates (includes step index) */
  uniqueAgentId?: string;
}

async function ensureProjectScaffold(cwd: string): Promise<void> {
  const agentsDir = path.resolve(cwd, '.codemachine', 'agents');
  const planDir = path.resolve(cwd, '.codemachine', 'plan');
  await mkdir(agentsDir, { recursive: true });
  await mkdir(planDir, { recursive: true });
}

async function runAgentsBuilderStep(cwd: string): Promise<void> {
  await ensureProjectScaffold(cwd);
}

/**
 * Executes a workflow step (main agent)
 *
 * This is a simplified version that delegates to execution/runner.ts
 * after building the prompt. No duplication with runner.ts anymore.
 */
export async function executeStep(
  step: WorkflowStep,
  cwd: string,
  options: StepExecutorOptions,
): Promise<string> {
  // Only module steps can be executed
  if (!isModuleStep(step)) {
    throw new Error('Only module steps can be executed');
  }

  // Load and process the prompt template
  const promptPath = path.isAbsolute(step.promptPath)
    ? step.promptPath
    : path.resolve(cwd, step.promptPath);
  const rawPrompt = await readFile(promptPath, 'utf8');
  const prompt = await processPromptString(rawPrompt, cwd);

  // Use environment variable or default to 30 minutes (1800000ms)
  const timeout =
    options.timeout ??
    (process.env.CODEMACHINE_AGENT_TIMEOUT
      ? Number.parseInt(process.env.CODEMACHINE_AGENT_TIMEOUT, 10)
      : 1800000);

  // Determine engine: step override > default
  const engineType: EngineType | undefined = step.engine;

  // Build telemetry callback that updates both UI and emitter
  const onTelemetry = options.uniqueAgentId
    ? (telemetry: import('../../cli/tui/routes/workflow/state/types.js').AgentTelemetry) => {
        options.ui?.updateAgentTelemetry(options.uniqueAgentId!, telemetry);
        options.emitter?.updateAgentTelemetry(options.uniqueAgentId!, telemetry);
      }
    : undefined;

  // Execute via the unified execution runner
  // Runner handles: auth, monitoring, engine execution, memory storage
  const result = await executeAgent(step.agentId, prompt, {
    workingDir: cwd,
    engine: engineType,
    model: step.model,
    logger: options.logger,
    stderrLogger: options.stderrLogger,
    onTelemetry,
    parentId: options.parentId,
    disableMonitoring: options.disableMonitoring,
    abortSignal: options.abortSignal,
    timeout,
    ui: options.ui,
    uniqueAgentId: options.uniqueAgentId,
  });

  // Run special post-execution steps
  const agentName = step.agentName.toLowerCase();
  if (step.agentId === 'agents-builder' || agentName.includes('builder')) {
    await runAgentsBuilderStep(cwd);
  }

  // NOTE: Telemetry is already updated via onTelemetry callback during streaming execution.
  // DO NOT parse from final output - it would match the FIRST telemetry line (early/wrong values)
  // instead of the LAST telemetry line (final/correct values), causing incorrect UI display.

  return result.output;
}
