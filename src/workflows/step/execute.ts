/**
 * Step Execution - Low Level Agent Runner
 *
 * Executes a single workflow step by delegating to the agent execution layer.
 * This handles prompt loading, processing, and agent invocation.
 */

import * as path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import type { WorkflowStep } from '../templates/index.js';
import { isModuleStep } from '../templates/types.js';
import type { EngineType } from '../../infra/engines/index.js';
import { processPromptString } from '../../shared/prompts/index.js';
import { execute, type ChainedPrompt } from '../../agents/execution/index.js';
import type { WorkflowEventEmitter } from '../events/emitter.js';
import { debug } from '../../shared/logging/logger.js';
import { resolvePromptPath } from '../../shared/imports/index.js';
import { resolvePackageRoot } from '../../shared/runtime/root.js';

const packageRoot = resolvePackageRoot(import.meta.url, 'step executor');

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
  /** Selected track for filtering track-specific chained prompt paths */
  selectedTrack?: string;
  /** Callback when monitoring ID is registered (for early access before execution completes) */
  onMonitoringRegistered?: (monitoringId: number) => void;
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
 * Execute a workflow step (agent invocation)
 *
 * This is the low-level execution that:
 * 1. Loads and processes the prompt
 * 2. Calls the agent execution layer
 * 3. Returns the output
 *
 * For orchestration (setup, post-exec), see run.ts
 */
export async function executeStep(
  step: WorkflowStep,
  cwd: string,
  options: StepExecutorOptions,
): Promise<StepOutput> {
  debug(`[step/execute] executeStep called for agentId=${step.type === 'module' ? step.agentId : 'N/A'}`);

  // Only module steps can be executed
  if (!isModuleStep(step)) {
    debug(`[step/execute] Not a module step, throwing error`);
    throw new Error('Only module steps can be executed');
  }

  const promptSources = Array.isArray(step.promptPath) ? step.promptPath : [step.promptPath];
  debug(`[step/execute] Loading prompt from ${promptSources.join(', ')}`);
  if (promptSources.length === 0) {
    throw new Error(`Agent ${step.agentId} has no promptPath configured`);
  }

  // Load and process the prompt template(s) - check imports first, then local
  const resolvedPromptPaths = promptSources.map(p => {
    if (path.isAbsolute(p)) return p;

    // Try to resolve from imports first, then fall back to cwd
    const importResolved = resolvePromptPath(p, packageRoot);
    if (importResolved) return importResolved;

    // Fall back to cwd-relative resolution
    return path.resolve(cwd, p);
  });
  debug(`[step/execute] Resolved promptPath(s): ${resolvedPromptPaths.join(', ')}`);

  let rawPrompt: string;
  try {
    const parts = await Promise.all(
      resolvedPromptPaths.map(async promptPath => {
        const content = await readFile(promptPath, 'utf8');
        debug(`[step/execute] Prompt loaded from ${promptPath}, length=${content.length}`);
        return content;
      }),
    );
    rawPrompt = parts.join('\n\n');
    debug(`[step/execute] Combined prompt length=${rawPrompt.length}`);
  } catch (fileError) {
    debug(`[step/execute] ERROR reading prompt file: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
    throw fileError;
  }

  const prompt = await processPromptString(rawPrompt, cwd);
  debug(`[step/execute] Prompt processed, length=${prompt.length}`);

  // Use environment variable or default to 30 minutes (1800000ms)
  const timeout =
    options.timeout ??
    (process.env.CODEMACHINE_AGENT_TIMEOUT
      ? Number.parseInt(process.env.CODEMACHINE_AGENT_TIMEOUT, 10)
      : 1800000);
  debug(`[step/execute] timeout=${timeout}ms`);

  // Determine engine: step override > default
  const engineType: EngineType | undefined = step.engine;
  debug(`[step/execute] engineType=${engineType}`);

  debug(`[step/execute] Calling execute...`);
  // Execute via the unified execution layer
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
    selectedTrack: options.selectedTrack,
    // Pass emitter as UI so runner can register monitoring ID immediately
    ui: options.emitter,
    // Telemetry auto-forwarding
    telemetry: options.uniqueAgentId && options.emitter
      ? { uniqueAgentId: options.uniqueAgentId, emitter: options.emitter }
      : undefined,
  });

  debug(`[step/execute] execute completed. agentId=${result.agentId}, outputLength=${result.output?.length ?? 0}`);

  // Run special post-execution steps
  const agentName = step.agentName.toLowerCase();
  if (step.agentId === 'agents-builder' || agentName.includes('builder')) {
    debug(`[step/execute] Running agents builder post-step`);
    await runAgentsBuilderStep(cwd);
  }

  debug(`[step/execute] executeStep returning`);
  return {
    output: result.output,
    monitoringId: result.agentId,
    chainedPrompts: result.chainedPrompts,
  };
}
