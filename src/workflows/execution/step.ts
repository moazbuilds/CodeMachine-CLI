import * as path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import type { WorkflowStep } from '../templates/index.js';
import { isModuleStep } from '../templates/types.js';
import type { EngineType } from '../../infra/engines/index.js';
import { processPromptString } from '../../shared/prompts/index.js';
import { execute, type ChainedPrompt } from '../../agents/execution/index.js';
import type { WorkflowEventEmitter } from '../events/emitter.js';
import { debug } from '../../shared/logging/logger.js';

export type { ChainedPrompt } from '../../agents/execution/index.js';

/**
 * Output from executing a workflow step
 */
export interface StepOutput {
  output: string;
  monitoringId?: number;
  chainedPrompts?: ChainedPrompt[];
}

export interface StepExecutorOptions {
  logger: (chunk: string) => void;
  stderrLogger: (chunk: string) => void;
  timeout?: number;
  emitter?: WorkflowEventEmitter;
  abortSignal?: AbortSignal;
  /** Parent agent ID for tracking relationships */
  parentId?: number;
  /** Disable monitoring (for special cases) */
  disableMonitoring?: boolean;
  /** Unique agent ID for UI updates (includes step index) */
  uniqueAgentId?: string;
  /** Monitoring ID for resuming (skip new registration, use existing log) */
  resumeMonitoringId?: number;
  /** Custom prompt for resume (instead of "Continue from where you left off") */
  resumePrompt?: string;
  /** Session ID for resuming (direct, for when monitoringId lookup fails) */
  resumeSessionId?: string;
  /** Selected conditions for filtering conditional chained prompt paths */
  selectedConditions?: string[];
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
): Promise<StepOutput> {
  debug(`[DEBUG step] executeStep called for agentId=${step.type === 'module' ? step.agentId : 'N/A'}`);

  // Only module steps can be executed
  if (!isModuleStep(step)) {
    debug(`[DEBUG step] Not a module step, throwing error`);
    throw new Error('Only module steps can be executed');
  }

  const promptSources = Array.isArray(step.promptPath) ? step.promptPath : [step.promptPath];
  debug(`[DEBUG step] Loading prompt from ${promptSources.join(', ')}`);
  if (promptSources.length === 0) {
    throw new Error(`Agent ${step.agentId} has no promptPath configured`);
  }
  // Load and process the prompt template(s)
  const resolvedPromptPaths = promptSources.map(p =>
    path.isAbsolute(p) ? p : path.resolve(cwd, p),
  );
  debug(`[DEBUG step] Resolved promptPath(s): ${resolvedPromptPaths.join(', ')}`);

  let rawPrompt: string;
  try {
    const parts = await Promise.all(
      resolvedPromptPaths.map(async promptPath => {
        const content = await readFile(promptPath, 'utf8');
        debug(`[DEBUG step] Prompt loaded from ${promptPath}, length=${content.length}`);
        return content;
      }),
    );
    rawPrompt = parts.join('\n\n');
    debug(`[DEBUG step] Combined prompt length=${rawPrompt.length}`);
  } catch (fileError) {
    debug(`[DEBUG step] ERROR reading prompt file: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
    throw fileError;
  }

  const prompt = await processPromptString(rawPrompt, cwd);
  debug(`[DEBUG step] Prompt processed, length=${prompt.length}`);

  // Use environment variable or default to 30 minutes (1800000ms)
  const timeout =
    options.timeout ??
    (process.env.CODEMACHINE_AGENT_TIMEOUT
      ? Number.parseInt(process.env.CODEMACHINE_AGENT_TIMEOUT, 10)
      : 1800000);
  debug(`[DEBUG step] timeout=${timeout}ms`);

  // Determine engine: step override > default
  const engineType: EngineType | undefined = step.engine;
  debug(`[DEBUG step] engineType=${engineType}`);

  debug(`[DEBUG step] Calling execute...`);
  // Execute via the unified execution layer
  // Handles: auth, monitoring, engine execution, memory storage, telemetry forwarding
  const result = await execute(step.agentId, prompt, {
    workingDir: cwd,
    engine: engineType,
    model: step.model,
    logger: options.logger,
    stderrLogger: options.stderrLogger,
    parentId: options.parentId,
    disableMonitoring: options.disableMonitoring,
    abortSignal: options.abortSignal,
    timeout,
    uniqueAgentId: options.uniqueAgentId,
    resumeMonitoringId: options.resumeMonitoringId,
    resumePrompt: options.resumePrompt,
    resumeSessionId: options.resumeSessionId,
    selectedConditions: options.selectedConditions,
    // Pass emitter as UI so runner can register monitoring ID immediately
    ui: options.emitter,
    // Telemetry auto-forwarding (replaces manual callback setup)
    telemetry: options.uniqueAgentId && options.emitter
      ? { uniqueAgentId: options.uniqueAgentId, emitter: options.emitter }
      : undefined,
  });

  debug(`[DEBUG step] execute completed. agentId=${result.agentId}, outputLength=${result.output?.length ?? 0}`);

  // Run special post-execution steps
  const agentName = step.agentName.toLowerCase();
  if (step.agentId === 'agents-builder' || agentName.includes('builder')) {
    debug(`[DEBUG step] Running agents builder post-step`);
    await runAgentsBuilderStep(cwd);
  }

  // NOTE: Telemetry is already updated via onTelemetry callback during streaming execution.
  // DO NOT parse from final output - it would match the FIRST telemetry line (early/wrong values)
  // instead of the LAST telemetry line (final/correct values), causing incorrect UI display.

  debug(`[DEBUG step] executeStep returning`);
  return {
    output: result.output,
    monitoringId: result.agentId,
    chainedPrompts: result.chainedPrompts,
  };
}
