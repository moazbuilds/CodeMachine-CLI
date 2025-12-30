/**
 * Step Lifecycle Hooks
 *
 * beforeRun() - Setup before step execution
 * afterRun() - Handle post-execution (directives, loops, checkpoints)
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

import { debug } from '../../shared/logging/logger.js';
import { handleLoopLogic, createActiveLoop, type ActiveLoop } from '../directives/loop/index.js';
import type { StepIndexManager } from '../indexing/index.js';
import { handleTriggerLogic } from '../directives/trigger/index.js';
import { handleCheckpointLogic } from '../directives/checkpoint/index.js';
import { handleErrorLogic } from '../directives/error/index.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import { type ModuleStep, type WorkflowTemplate, isModuleStep } from '../templates/types.js';
import { getUniqueAgentId } from '../context/index.js';
import type { RunnerContext } from '../runner/types.js';

/**
 * Options for beforeRun hook
 */
export interface BeforeRunOptions {
  ctx: RunnerContext;
  stepIndex: number;
  uniqueAgentId: string;
  isResume?: boolean;
}

/**
 * Result from beforeRun hook
 */
export interface BeforeRunResult {
  abortController: AbortController;
}

/**
 * Setup before step execution
 *
 * - Resets signal manager
 * - Creates abort controller
 * - Updates UI status
 * - Resets directive file
 */
export function beforeRun(options: BeforeRunOptions): BeforeRunResult {
  const { ctx, stepIndex, uniqueAgentId, isResume } = options;
  const machineCtx = ctx.machine.context;
  const step = ctx.moduleSteps[stepIndex];

  debug('[step/hooks] beforeRun for step %d: %s', stepIndex, step.agentName);

  // Clear paused flag
  machineCtx.paused = false;

  // Reset signal manager (only for fresh start, not resume)
  if (!isResume) {
    ctx.signalManager.resetAll();
  }

  // Set up abort controller
  const abortController = new AbortController();
  ctx.setAbortController(abortController);
  ctx.signalManager.setAbortController(abortController);

  // Set step context for signals
  ctx.signalManager.setStepContext({
    stepIndex,
    agentId: uniqueAgentId,
    agentName: step.agentName,
  });

  // Update UI
  ctx.emitter.updateAgentStatus(uniqueAgentId, 'running');

  // Reset directive file (only for fresh start)
  if (!isResume) {
    const directiveFile = path.join(ctx.cwd, '.codemachine/memory/directive.json');
    const directiveDir = path.dirname(directiveFile);
    if (!fs.existsSync(directiveDir)) {
      fs.mkdirSync(directiveDir, { recursive: true });
    }
    fs.writeFileSync(directiveFile, JSON.stringify({ action: 'continue' }, null, 2));
  }

  return { abortController };
}

/**
 * Cleanup after step execution (success or failure)
 */
export function cleanupRun(ctx: RunnerContext): void {
  ctx.setAbortController(null);
  ctx.signalManager.setAbortController(null);
  // Keep stepContext - still valid during waiting state
}

/**
 * Options for afterRun hook
 */
export interface AfterRunOptions {
  step: ModuleStep;
  stepOutput: { output: string };
  cwd: string;
  cmRoot: string;
  index: number;
  emitter: WorkflowEventEmitter;
  uniqueAgentId: string;
  abortController: AbortController;
  template: WorkflowTemplate;
  loopCounters: Map<string, number>;
  activeLoop: ActiveLoop | null;
  engineType: string;
  /** Step index manager for lifecycle tracking */
  indexManager: StepIndexManager;
}

/**
 * Result from afterRun hook
 */
export interface AfterRunResult {
  shouldBreak: boolean;
  newIndex?: number;
  newActiveLoop?: ActiveLoop | null;
  stoppedByCheckpointQuit?: boolean;
  workflowShouldStop?: boolean;
  checkpointContinued?: boolean;
}

/**
 * Execute a triggered agent
 */
async function executeTriggerAgent(options: {
  triggerAgentId: string;
  cwd: string;
  engineType: string;
  logger: (chunk: string) => void;
  stderrLogger: (chunk: string) => void;
  sourceAgentId: string;
  emitter: WorkflowEventEmitter;
  abortSignal: AbortSignal;
}): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { executeTriggerAgent: execTrigger } = await import('../directives/trigger/execute.js');
  await execTrigger(options);
}

/**
 * Post-step action type for processPostStepDirectives
 */
export type PostStepAction =
  | { type: 'advance' }
  | { type: 'loop'; targetIndex: number; newActiveLoop: ActiveLoop | null }
  | { type: 'stop' }
  | { type: 'checkpoint' };

/**
 * Context for processPostStepDirectives
 */
export interface ProcessPostStepContext {
  ctx: RunnerContext;
  step: ModuleStep;
  stepOutput: { output: string };
  stepIndex: number;
  uniqueAgentId: string;
}

/**
 * Process post-step directives and return action
 *
 * This is a simplified wrapper around afterRun() that returns a clear action type.
 * Used by autonomous prompt loops to check directives after chained prompts complete.
 */
export async function processPostStepDirectives(context: ProcessPostStepContext): Promise<PostStepAction> {
  const { ctx, step, stepOutput, stepIndex, uniqueAgentId } = context;

  // Get or create abort controller for afterRun
  const abortController = ctx.getAbortController() ?? new AbortController();

  const postResult = await afterRun({
    step,
    stepOutput,
    cwd: ctx.cwd,
    cmRoot: ctx.cmRoot,
    index: stepIndex,
    emitter: ctx.emitter,
    uniqueAgentId,
    abortController,
    template: ctx.template,
    loopCounters: ctx.getLoopCounters(),
    activeLoop: ctx.getActiveLoop(),
    engineType: step.engine ?? 'claude-code',
    indexManager: ctx.indexManager,
  });

  // Handle results
  if (postResult.workflowShouldStop) {
    return { type: 'stop' };
  }

  if (postResult.checkpointContinued) {
    return { type: 'checkpoint' };
  }

  // Handle loop - newIndex is the raw index from loop logic
  if (postResult.newIndex !== undefined) {
    // Update active loop state
    if (postResult.newActiveLoop !== undefined) {
      ctx.setActiveLoop(postResult.newActiveLoop);
    }
    // Return target index (add 1 because newIndex is 0-based target - 1)
    return {
      type: 'loop',
      targetIndex: postResult.newIndex + 1,
      newActiveLoop: postResult.newActiveLoop ?? null,
    };
  }

  // Update active loop state for non-loop cases too
  if (postResult.newActiveLoop !== undefined) {
    ctx.setActiveLoop(postResult.newActiveLoop);
  }

  return { type: 'advance' };
}

/**
 * Handle post-execution directives: error → trigger → checkpoint → loop
 */
export async function afterRun(options: AfterRunOptions): Promise<AfterRunResult> {
  const {
    step,
    stepOutput,
    cwd,
    cmRoot: _cmRoot,
    index,
    emitter,
    uniqueAgentId,
    abortController,
    template,
    loopCounters,
    activeLoop,
    engineType,
    indexManager,
  } = options;

  // Check for error directive first (highest priority)
  const errorResult = await handleErrorLogic(step, stepOutput.output, cwd, emitter);
  if (errorResult?.shouldStopWorkflow) {
    emitter.setWorkflowStatus('error');
    (process as NodeJS.EventEmitter).emit('workflow:error', { reason: errorResult.reason });
    return { shouldBreak: true, workflowShouldStop: true };
  }

  // Check for trigger directive
  const triggerResult = await handleTriggerLogic(step, stepOutput.output, cwd, emitter);
  if (triggerResult?.shouldTrigger && triggerResult.triggerAgentId) {
    const triggeredAgentId = triggerResult.triggerAgentId;
    try {
      await executeTriggerAgent({
        triggerAgentId: triggeredAgentId,
        cwd,
        engineType,
        logger: () => {},
        stderrLogger: () => {},
        sourceAgentId: uniqueAgentId,
        emitter,
        abortSignal: abortController.signal,
      });
    } catch (triggerError) {
      if (triggerError instanceof Error && triggerError.name === 'AbortError') {
        emitter.updateAgentStatus(triggeredAgentId, 'skipped');
      }
    }
  }

  // Mark step as completed if executeOnce is true
  // Uses indexManager for centralized lifecycle tracking
  if (step.executeOnce) {
    await indexManager.stepCompleted(index);
  }

  // Check for checkpoint directive
  const checkpointResult = await handleCheckpointLogic(step, stepOutput.output, cwd, emitter);
  if (checkpointResult?.shouldStopWorkflow) {
    const checkpointAction = await new Promise<'continue' | 'quit'>((resolve) => {
      const continueHandler = () => { cleanup(); resolve('continue'); };
      const quitHandler = () => { cleanup(); resolve('quit'); };
      const cleanup = () => {
        process.removeListener('checkpoint:continue', continueHandler);
        process.removeListener('checkpoint:quit', quitHandler);
      };
      process.once('checkpoint:continue', continueHandler);
      process.once('checkpoint:quit', quitHandler);
    });

    emitter.clearCheckpointState();

    if (checkpointAction === 'quit') {
      emitter.setWorkflowStatus('stopped');
      return { shouldBreak: true, stoppedByCheckpointQuit: true, workflowShouldStop: true };
    }
    return { shouldBreak: false, checkpointContinued: true };
  }

  // Check for loop directive
  const loopResult = await handleLoopLogic(step, index, stepOutput.output, loopCounters, cwd, emitter);

  if (loopResult.decision?.shouldRepeat) {
    const newActiveLoop = createActiveLoop(loopResult.decision);

    // Update UI loop state
    const loopKey = `${step.module?.id ?? step.agentId}:${index}`;
    const iteration = (loopCounters.get(loopKey) || 0) + 1;
    const loopState = {
      active: true,
      sourceAgent: uniqueAgentId,
      backSteps: loopResult.decision.stepsBack,
      iteration,
      maxIterations: step.module?.behavior?.type === 'loop' ? step.module.behavior.maxIterations ?? Infinity : Infinity,
      skipList: loopResult.decision.skipList || [],
      reason: loopResult.decision.reason,
    };
    emitter.setLoopState(loopState);

    // Reset agents that will be re-executed
    for (let resetIndex = loopResult.newIndex; resetIndex <= index; resetIndex += 1) {
      const resetStep = template.steps[resetIndex];
      if (resetStep && isModuleStep(resetStep)) {
        const resetUniqueAgentId = getUniqueAgentId(resetStep, resetIndex);
        emitter.resetAgentForLoop(resetUniqueAgentId, iteration);
      }
    }

    return {
      shouldBreak: false,
      newIndex: loopResult.newIndex,
      newActiveLoop,
    };
  }

  // Clear active loop only when a loop step explicitly terminates
  const newActiveLoop = createActiveLoop(loopResult.decision);
  if (newActiveLoop !== (undefined as unknown as ActiveLoop | null)) {
    if (!newActiveLoop) {
      emitter.setLoopState(null);
      emitter.clearLoopRound(uniqueAgentId);
    }
    return { shouldBreak: false, newActiveLoop };
  }

  return { shouldBreak: false, newActiveLoop: activeLoop };
}
