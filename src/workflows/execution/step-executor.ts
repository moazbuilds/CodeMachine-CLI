/**
 * Step Executor
 *
 * Handles executing workflow steps (agents).
 * Extracted from WorkflowRunner for modularity.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

import { debug } from '../../shared/logging/logger.js';
import { AgentMonitorService } from '../../agents/monitoring/index.js';
import type { ModuleStep } from '../templates/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { StateMachine, StepOutput } from '../state/index.js';
import { executeStep } from './step.js';
import { selectEngine } from './engine.js';
import { registry } from '../../infra/engines/index.js';
import {
  markStepStarted,
  initStepSession,
  markStepCompleted,
  getStepData,
  updateStepDuration,
  updateStepTelemetry,
  getStepDuration,
  getStepTelemetry,
} from '../../shared/workflows/steps.js';
import { getSelectedConditions } from '../../shared/workflows/index.js';
import { loadAgentConfig } from '../../agents/runner/config.js';
import { loadChainedPrompts } from '../../agents/runner/chained.js';

/**
 * Options for executing the current step
 */
export interface ExecuteCurrentStepOptions {
  cwd: string;
  cmRoot: string;
  emitter: WorkflowEventEmitter;
  machine: StateMachine;
  moduleSteps: ModuleStep[];
  getAbortController: () => AbortController | null;
  setAbortController: (controller: AbortController | null) => void;
  isPauseRequested: () => boolean;
  resetPauseRequested: () => void;
}

/**
 * Execute the current workflow step
 */
export async function executeCurrentStep(options: ExecuteCurrentStepOptions): Promise<void> {
  const {
    cwd,
    cmRoot,
    emitter,
    machine,
    moduleSteps,
    getAbortController,
    setAbortController,
    isPauseRequested,
    resetPauseRequested,
  } = options;

  const ctx = machine.context;
  const step = moduleSteps[ctx.currentStepIndex];
  const uniqueAgentId = `${step.agentId}-step-${ctx.currentStepIndex}`;

  debug('[StepExecutor] Executing step %d: %s', ctx.currentStepIndex, step.agentName);

  // Check for resume data (existing session from previous run)
  const stepData = await getStepData(cmRoot, ctx.currentStepIndex);
  const isResuming = stepData?.sessionId && !stepData.completedAt;

  // If resuming, skip execution and go directly to waiting state
  if (isResuming) {
    await handleResumeStep(options, step, stepData, uniqueAgentId);
    return;
  }

  // Track step start for resume
  await markStepStarted(cmRoot, ctx.currentStepIndex);

  // Track step start time for duration accumulation
  const stepStartTime = Date.now();

  // Reset pause flag
  resetPauseRequested();

  // Set up abort controller
  const abortController = new AbortController();
  setAbortController(abortController);

  // Update UI - show initializing while setting up agent
  emitter.updateAgentStatus(uniqueAgentId, 'initializing');
  emitter.logMessage(uniqueAgentId, '═'.repeat(80));
  emitter.logMessage(uniqueAgentId, `[Step ${ctx.currentStepIndex + 1}/${moduleSteps.length}] ${step.agentName} started to work.`);

  // Reset behavior file
  const behaviorFile = path.join(cwd, '.codemachine/memory/behavior.json');
  const behaviorDir = path.dirname(behaviorFile);
  if (!fs.existsSync(behaviorDir)) {
    fs.mkdirSync(behaviorDir, { recursive: true });
  }
  fs.writeFileSync(behaviorFile, JSON.stringify({ action: 'continue' }, null, 2));

  // Determine engine
  const engineType = await selectEngine(step, emitter, uniqueAgentId);
  step.engine = engineType;
  emitter.updateAgentEngine(uniqueAgentId, engineType);

  // Resolve model
  const engineModule = registry.get(engineType);
  const resolvedModel = step.model ?? engineModule?.metadata.defaultModel;
  if (resolvedModel) {
    emitter.updateAgentModel(uniqueAgentId, resolvedModel);
  }

  // Initialization complete - now running
  emitter.updateAgentStatus(uniqueAgentId, 'running');

  try {
    // Execute the step
    const output = await executeStep(step, cwd, {
      logger: () => {},
      stderrLogger: () => {},
      emitter,
      abortSignal: abortController.signal,
      uniqueAgentId,
      resumeMonitoringId: undefined,
      resumeSessionId: undefined,
      resumePrompt: undefined,
    });

    // Check if paused
    if (isPauseRequested()) {
      debug('[StepExecutor] Step was paused');
      emitter.logMessage(uniqueAgentId, `${step.agentName} paused.`);
      machine.send({ type: 'PAUSE' });
      return;
    }

    // Step completed
    debug('[StepExecutor] Step completed');

    // Track session info for resume
    if (output.monitoringId !== undefined) {
      const monitor = AgentMonitorService.getInstance();
      const agentInfo = monitor.getAgent(output.monitoringId);
      const sessionId = agentInfo?.sessionId ?? '';
      await initStepSession(cmRoot, ctx.currentStepIndex, sessionId, output.monitoringId);

      // Save accumulated duration
      const stepDuration = Date.now() - stepStartTime;
      await updateStepDuration(cmRoot, ctx.currentStepIndex, stepDuration);

      // Log step completion with duration
      const durationSec = Math.floor(stepDuration / 1000);
      const durationMin = Math.floor(durationSec / 60);
      const durationStr = durationMin > 0 ? `${durationMin}m ${durationSec % 60}s` : `${durationSec}s`;
      emitter.logMessage(uniqueAgentId, `[Step ${ctx.currentStepIndex + 1}/${moduleSteps.length}] Completed in ${durationStr}`);

      // Save accumulated telemetry
      if (agentInfo?.telemetry) {
        await updateStepTelemetry(cmRoot, ctx.currentStepIndex, {
          tokensIn: agentInfo.telemetry.tokensIn ?? 0,
          tokensOut: agentInfo.telemetry.tokensOut ?? 0,
          cost: agentInfo.telemetry.cost ?? 0,
          cached: agentInfo.telemetry.cached,
        });
      }
    }

    const stepOutput: StepOutput = {
      output: output.output,
      monitoringId: output.monitoringId,
    };

    // Update context with chained prompts if any
    debug('[StepExecutor] chainedPrompts from output: %d items', output.chainedPrompts?.length ?? 0);
    if (output.chainedPrompts && output.chainedPrompts.length > 0) {
      debug('[StepExecutor] Setting promptQueue with %d chained prompts:', output.chainedPrompts.length);
      output.chainedPrompts.forEach((p, i) => debug('[StepExecutor]   [%d] %s: %s', i, p.name, p.label));
      machine.context.promptQueue = output.chainedPrompts;
      machine.context.promptQueueIndex = 0;
      // Show checkpoint status only in manual mode - in auto mode, keep running status
      if (!ctx.autoMode) {
        emitter.updateAgentStatus(uniqueAgentId, 'checkpoint');
        debug('[StepExecutor] Agent at checkpoint, waiting for chained prompt input');
      } else {
        debug('[StepExecutor] Auto mode - keeping running status for autopilot processing');
      }
    } else {
      debug('[StepExecutor] No chained prompts, marking agent completed');
      emitter.updateAgentStatus(uniqueAgentId, 'completed');
      machine.context.promptQueue = [];
      machine.context.promptQueueIndex = 0;
    }

    machine.send({ type: 'STEP_COMPLETE', output: stepOutput });
  } catch (error) {
    // Handle abort
    if (error instanceof Error && error.name === 'AbortError') {
      await handleAbort(options, step, stepStartTime, uniqueAgentId);
      return;
    }

    // Real error
    debug('[StepExecutor] Step error: %s', (error as Error).message);
    emitter.updateAgentStatus(uniqueAgentId, 'failed');
    machine.send({ type: 'STEP_ERROR', error: error as Error });
  } finally {
    setAbortController(null);
  }
}

/**
 * Handle resuming a step that was previously started
 */
async function handleResumeStep(
  options: ExecuteCurrentStepOptions,
  step: ModuleStep,
  stepData: NonNullable<Awaited<ReturnType<typeof getStepData>>>,
  uniqueAgentId: string
): Promise<void> {
  const { cwd, cmRoot, emitter, machine, moduleSteps } = options;
  const ctx = machine.context;

  debug('[StepExecutor] Resuming step %d - going to waiting state', ctx.currentStepIndex);

  // Show initializing status while loading resume data
  emitter.updateAgentStatus(uniqueAgentId, 'initializing');

  // Register monitoring ID so TUI loads existing logs
  if (stepData.monitoringId !== undefined) {
    emitter.registerMonitoringId(uniqueAgentId, stepData.monitoringId);
  }

  // Load accumulated duration (actual runtime, not wall-clock time)
  // This ensures offline periods aren't counted in the timer
  const previousDuration = await getStepDuration(cmRoot, ctx.currentStepIndex);

  const previousTelemetry = await getStepTelemetry(cmRoot, ctx.currentStepIndex);
  if (previousDuration > 0 || previousTelemetry) {
    emitter.updateAgentTelemetry(uniqueAgentId, {
      duration: previousDuration > 0 ? previousDuration : undefined,
      tokensIn: previousTelemetry?.tokensIn,
      tokensOut: previousTelemetry?.tokensOut,
      cost: previousTelemetry?.cost,
      cached: previousTelemetry?.cached,
    });
  }

  // Load chained prompts for this step if agent has them configured
  try {
    const agentConfig = await loadAgentConfig(step.agentId, cwd);
    if (agentConfig?.chainedPromptsPath) {
      const selectedConditions = await getSelectedConditions(cmRoot);
      const allChainedPrompts = await loadChainedPrompts(
        agentConfig.chainedPromptsPath,
        cwd,
        selectedConditions
      );

      // Filter out already completed chains
      const completedChains = new Set(stepData.completedChains ?? []);
      const remainingPrompts = allChainedPrompts.filter(
        (_, index) => !completedChains.has(index)
      );

      if (remainingPrompts.length > 0) {
        ctx.promptQueue = remainingPrompts;
        ctx.promptQueueIndex = 0;
        debug('[StepExecutor] Loaded %d remaining chained prompts for resume', remainingPrompts.length);
      }
    }
  } catch (err) {
    debug('[StepExecutor] Failed to load chained prompts for resume: %s', err instanceof Error ? err.message : String(err));
  }

  // Only show checkpoint status in manual mode - in auto mode, autopilot will handle it
  if (!ctx.autoMode) {
    emitter.updateAgentStatus(uniqueAgentId, 'checkpoint');
  }
  emitter.logMessage(uniqueAgentId, '═'.repeat(80));
  emitter.logMessage(uniqueAgentId, `${step.agentName} resumed - waiting for input.`);

  // Set context with saved data
  ctx.currentMonitoringId = stepData.monitoringId;
  ctx.currentOutput = {
    output: '',
    monitoringId: stepData.monitoringId,
  };

  // Go to waiting state
  machine.send({
    type: 'STEP_COMPLETE',
    output: { output: '', monitoringId: stepData.monitoringId },
  });
}

/**
 * Handle abort (pause or skip)
 */
async function handleAbort(
  options: ExecuteCurrentStepOptions,
  step: ModuleStep,
  stepStartTime: number,
  uniqueAgentId: string
): Promise<void> {
  const { cmRoot, emitter, machine, moduleSteps, isPauseRequested } = options;
  const ctx = machine.context;

  // Save accumulated duration for the time spent before abort
  const stepDuration = Date.now() - stepStartTime;
  await updateStepDuration(cmRoot, ctx.currentStepIndex, stepDuration);

  // Try to save telemetry if we have a monitoring ID
  if (ctx.currentMonitoringId !== undefined) {
    const monitor = AgentMonitorService.getInstance();
    const agentInfo = monitor.getAgent(ctx.currentMonitoringId);
    if (agentInfo?.telemetry) {
      await updateStepTelemetry(cmRoot, ctx.currentStepIndex, {
        tokensIn: agentInfo.telemetry.tokensIn ?? 0,
        tokensOut: agentInfo.telemetry.tokensOut ?? 0,
        cost: agentInfo.telemetry.cost ?? 0,
        cached: agentInfo.telemetry.cached,
      });
    }
  }

  if (isPauseRequested()) {
    debug('[StepExecutor] Step aborted due to pause');
    emitter.logMessage(uniqueAgentId, `${step.agentName} paused.`);
    machine.send({ type: 'PAUSE' });
  } else {
    debug('[StepExecutor] Step aborted (skip)');
    emitter.updateAgentStatus(uniqueAgentId, 'skipped');
    emitter.logMessage(uniqueAgentId, `${step.agentName} was skipped.`);
    // Track step completion for resume - mark as skipped since no agent ran to completion
    await markStepCompleted(cmRoot, ctx.currentStepIndex, { skipped: true });
    machine.send({ type: 'SKIP' });
  }
}
