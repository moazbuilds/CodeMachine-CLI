/**
 * Workflow Runner
 *
 * Orchestrates workflow execution using:
 * - State machine for state management
 * - Input providers for getting input (user or controller)
 * - Step executor for running agents
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

import { debug } from '../../shared/logging/logger.js';
import { formatUserInput } from '../../shared/formatters/outputMarkers.js';
import { AgentLoggerService, AgentMonitorService } from '../../agents/monitoring/index.js';
import type { ModuleStep, WorkflowTemplate } from '../templates/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import {
  createWorkflowMachine,
  type StateMachine,
  type WorkflowContext,
  type StepOutput,
} from '../state/index.js';
import {
  UserInputProvider,
  ControllerInputProvider,
  createInputEmitter,
  type InputProvider,
  type InputEventEmitter,
  type InputContext,
} from '../input/index.js';
import { executeStep } from './step.js';
import { selectEngine } from './engine.js';
import { loadControllerConfig } from '../../shared/workflows/controller.js';
import { registry } from '../../infra/engines/index.js';
import {
  markStepStarted,
  initStepSession,
  markChainCompleted,
  markStepCompleted,
  getStepData,
  getChainResumeInfo,
} from '../../shared/workflows/steps.js';

/**
 * Runner options
 */
export interface WorkflowRunnerOptions {
  cwd: string;
  cmRoot: string;
  template: WorkflowTemplate;
  emitter: WorkflowEventEmitter;
  startIndex?: number;
}

/**
 * Workflow runner class
 */
export class WorkflowRunner {
  private machine: StateMachine;
  private emitter: WorkflowEventEmitter;
  private inputEmitter: InputEventEmitter;

  private userInput: UserInputProvider;
  private controllerInput: ControllerInputProvider;
  private activeProvider: InputProvider;

  private cwd: string;
  private cmRoot: string;
  private template: WorkflowTemplate;
  private moduleSteps: ModuleStep[];

  private abortController: AbortController | null = null;
  private pauseRequested = false;

  constructor(options: WorkflowRunnerOptions) {
    this.cwd = options.cwd;
    this.cmRoot = options.cmRoot;
    this.template = options.template;
    this.emitter = options.emitter;

    // Filter to only module steps
    this.moduleSteps = options.template.steps.filter(
      (s): s is ModuleStep => s.type === 'module'
    );

    // Create input emitter
    this.inputEmitter = createInputEmitter(options.emitter);

    // Create input providers
    this.userInput = new UserInputProvider({
      emitter: this.inputEmitter,
    });

    this.controllerInput = new ControllerInputProvider({
      emitter: this.inputEmitter,
      getControllerConfig: () => this.getControllerConfig(),
      cwd: this.cwd,
    });

    // Default to user input
    this.activeProvider = this.userInput;

    // Create state machine
    this.machine = createWorkflowMachine({
      currentStepIndex: options.startIndex ?? 0,
      totalSteps: this.moduleSteps.length,
      steps: this.moduleSteps,
      cwd: this.cwd,
      cmRoot: this.cmRoot,
      autoMode: false,
      promptQueue: [],
      promptQueueIndex: 0,
      currentOutput: null,
    });

    // Set up event listeners
    this.setupListeners();
  }

  private async getControllerConfig() {
    const state = await loadControllerConfig(this.cmRoot);
    return state?.controllerConfig ?? null;
  }

  private setupListeners(): void {
    // Pause listener
    const pauseHandler = () => {
      debug('[Runner] Pause requested');
      this.pauseRequested = true;
      this.abortController?.abort();
    };
    process.on('workflow:pause', pauseHandler);

    // Skip listener (Ctrl+S while agent running)
    const skipHandler = () => {
      debug('[Runner] Skip requested');
      this.abortController?.abort();
    };
    process.on('workflow:skip', skipHandler);

    // Stop listener
    const stopHandler = () => {
      debug('[Runner] Stop requested');
      this.abortController?.abort();
      this.machine.send({ type: 'STOP' });
    };
    process.on('workflow:stop', stopHandler);

    // Mode change listener
    const modeChangeHandler = async (data: { autonomousMode: boolean }) => {
      debug('[Runner] Mode change: autoMode=%s', data.autonomousMode);
      // If in waiting state, let the provider's listener handle it
      // The provider will return __SWITCH_TO_AUTO__ or __SWITCH_TO_MANUAL__
      // and handleWaiting() will call setAutoMode()
      if (this.machine.state === 'waiting') {
        debug('[Runner] In waiting state, provider will handle mode switch');
        return;
      }
      // In other states (running, idle), set auto mode directly
      await this.setAutoMode(data.autonomousMode);
    };
    process.on('workflow:mode-change', modeChangeHandler);

    // Clean up on machine final state
    this.machine.subscribe((state) => {
      if (this.machine.isFinal) {
        process.removeListener('workflow:pause', pauseHandler);
        process.removeListener('workflow:skip', skipHandler);
        process.removeListener('workflow:stop', stopHandler);
        process.removeListener('workflow:mode-change', modeChangeHandler);
      }
    });
  }

  /**
   * Run the workflow
   */
  async run(): Promise<void> {
    debug('[Runner] Starting workflow: %s', this.template.name);

    // Load initial auto mode state
    const controllerState = await loadControllerConfig(this.cmRoot);
    if (controllerState?.autonomousMode && controllerState.controllerConfig) {
      await this.setAutoMode(true);
    }

    // Start the machine
    this.machine.send({ type: 'START' });
    this.emitter.setWorkflowStatus('running');

    // Main loop
    while (!this.machine.isFinal) {
      const state = this.machine.state;
      const ctx = this.machine.context;

      if (state === 'running') {
        await this.executeCurrentStep();
      } else if (state === 'waiting') {
        await this.handleWaiting();
      }
    }

    // Final state handling
    const finalState = this.machine.state;
    debug('[Runner] Workflow ended in state: %s', finalState);

    if (finalState === 'completed') {
      this.emitter.setWorkflowStatus('completed');
    } else if (finalState === 'stopped') {
      this.emitter.setWorkflowStatus('stopped');
    } else if (finalState === 'error') {
      this.emitter.setWorkflowStatus('error');
      const error = this.machine.context.lastError;
      if (error) {
        (process as NodeJS.EventEmitter).emit('workflow:error', {
          reason: error.message,
        });
      }
    }
  }

  /**
   * Execute the current step
   */
  private async executeCurrentStep(): Promise<void> {
    const ctx = this.machine.context;
    const step = this.moduleSteps[ctx.currentStepIndex];
    const uniqueAgentId = `${step.agentId}-step-${ctx.currentStepIndex}`;

    debug('[Runner] Executing step %d: %s', ctx.currentStepIndex, step.agentName);

    // Check for resume data (existing session from previous run)
    const stepData = await getStepData(this.cmRoot, ctx.currentStepIndex);
    const isResuming = stepData?.sessionId && !stepData.completedAt;

    // If resuming, skip execution and go directly to waiting state
    if (isResuming) {
      debug('[Runner] Resuming step %d - going to waiting state', ctx.currentStepIndex);

      // Register monitoring ID so TUI loads existing logs
      if (stepData.monitoringId !== undefined) {
        this.emitter.registerMonitoringId(uniqueAgentId, stepData.monitoringId);
      }

      this.emitter.updateAgentStatus(uniqueAgentId, 'checkpoint');
      this.emitter.logMessage(uniqueAgentId, '═'.repeat(80));
      this.emitter.logMessage(uniqueAgentId, `${step.agentName} resumed - waiting for input.`);

      // Set context with saved data
      ctx.currentMonitoringId = stepData.monitoringId;
      ctx.currentOutput = {
        output: '',
        monitoringId: stepData.monitoringId,
      };

      // Go to waiting state
      this.machine.send({
        type: 'STEP_COMPLETE',
        output: { output: '', monitoringId: stepData.monitoringId },
      });
      return;
    }

    // Track step start for resume
    await markStepStarted(this.cmRoot, ctx.currentStepIndex);

    // Reset pause flag
    this.pauseRequested = false;

    // Set up abort controller
    this.abortController = new AbortController();

    // Update UI
    this.emitter.updateAgentStatus(uniqueAgentId, 'running');
    this.emitter.logMessage(uniqueAgentId, '═'.repeat(80));
    this.emitter.logMessage(uniqueAgentId, `${step.agentName} ${isResuming ? 'resumed work.' : 'started to work.'}`);

    // Reset behavior file
    const behaviorFile = path.join(this.cwd, '.codemachine/memory/behavior.json');
    const behaviorDir = path.dirname(behaviorFile);
    if (!fs.existsSync(behaviorDir)) {
      fs.mkdirSync(behaviorDir, { recursive: true });
    }
    fs.writeFileSync(behaviorFile, JSON.stringify({ action: 'continue' }, null, 2));

    // Determine engine
    const engineType = await selectEngine(step, this.emitter, uniqueAgentId);
    step.engine = engineType;
    this.emitter.updateAgentEngine(uniqueAgentId, engineType);

    // Resolve model
    const engineModule = registry.get(engineType);
    const resolvedModel = step.model ?? engineModule?.metadata.defaultModel;
    if (resolvedModel) {
      this.emitter.updateAgentModel(uniqueAgentId, resolvedModel);
    }

    try {
      // Execute the step (with resume data if available)
      const output = await executeStep(step, this.cwd, {
        logger: () => {},
        stderrLogger: () => {},
        emitter: this.emitter,
        abortSignal: this.abortController.signal,
        uniqueAgentId,
        resumeMonitoringId: isResuming ? stepData.monitoringId : undefined,
        resumeSessionId: isResuming ? stepData.sessionId : undefined,
        resumePrompt: isResuming ? 'Continue from where you left off.' : undefined,
      });

      // Check if paused
      if (this.pauseRequested) {
        debug('[Runner] Step was paused');
        this.emitter.logMessage(uniqueAgentId, `${step.agentName} paused.`);
        this.machine.send({ type: 'PAUSE' });
        return;
      }

      // Step completed
      debug('[Runner] Step completed');

      // Track session info for resume
      if (output.monitoringId !== undefined) {
        const monitor = AgentMonitorService.getInstance();
        const agentInfo = monitor.getAgent(output.monitoringId);
        const sessionId = agentInfo?.sessionId ?? '';
        await initStepSession(this.cmRoot, ctx.currentStepIndex, sessionId, output.monitoringId);
      }

      const stepOutput: StepOutput = {
        output: output.output,
        monitoringId: output.monitoringId,
      };

      // Update context with chained prompts if any
      debug('[Runner] chainedPrompts from output: %d items', output.chainedPrompts?.length ?? 0);
      if (output.chainedPrompts && output.chainedPrompts.length > 0) {
        debug('[Runner] Setting promptQueue with %d chained prompts:', output.chainedPrompts.length);
        output.chainedPrompts.forEach((p, i) => debug('[Runner]   [%d] %s: %s', i, p.name, p.label));
        this.machine.context.promptQueue = output.chainedPrompts;
        this.machine.context.promptQueueIndex = 0;
        // Show checkpoint status while waiting for chained prompt input
        this.emitter.updateAgentStatus(uniqueAgentId, 'checkpoint');
        debug('[Runner] Agent at checkpoint, waiting for chained prompt input');
      } else {
        debug('[Runner] No chained prompts, marking agent completed');
        this.emitter.updateAgentStatus(uniqueAgentId, 'completed');
        this.machine.context.promptQueue = [];
        this.machine.context.promptQueueIndex = 0;
      }

      this.machine.send({ type: 'STEP_COMPLETE', output: stepOutput });
    } catch (error) {
      // Handle abort
      if (error instanceof Error && error.name === 'AbortError') {
        if (this.pauseRequested) {
          debug('[Runner] Step aborted due to pause');
          this.emitter.logMessage(uniqueAgentId, `${step.agentName} paused.`);
          this.machine.send({ type: 'PAUSE' });
        } else {
          debug('[Runner] Step aborted (skip)');
          this.emitter.updateAgentStatus(uniqueAgentId, 'skipped');
          this.emitter.logMessage(uniqueAgentId, `${step.agentName} was skipped.`);
          // Track step completion for resume
          await markStepCompleted(this.cmRoot, ctx.currentStepIndex);
          this.machine.send({ type: 'SKIP' });
        }
        return;
      }

      // Real error
      debug('[Runner] Step error: %s', (error as Error).message);
      this.emitter.updateAgentStatus(uniqueAgentId, 'failed');
      this.machine.send({ type: 'STEP_ERROR', error: error as Error });
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Handle waiting state - get input from provider
   */
  private async handleWaiting(): Promise<void> {
    const ctx = this.machine.context;

    debug('[Runner] Handling waiting state, autoMode=%s, promptQueue=%d items, queueIndex=%d',
      ctx.autoMode, ctx.promptQueue.length, ctx.promptQueueIndex);

    // Build input context
    const inputContext: InputContext = {
      stepOutput: ctx.currentOutput ?? { output: '' },
      stepIndex: ctx.currentStepIndex,
      totalSteps: ctx.totalSteps,
      promptQueue: ctx.promptQueue,
      promptQueueIndex: ctx.promptQueueIndex,
      cwd: this.cwd,
    };

    // Get input from active provider
    const result = await this.activeProvider.getInput(inputContext);

    debug('[Runner] Got input result: type=%s', result.type);

    // Handle special switch-to-manual signal
    if (result.type === 'input' && result.value === '__SWITCH_TO_MANUAL__') {
      debug('[Runner] Switching to manual mode');
      await this.setAutoMode(false);
      // Re-run waiting with user input
      return;
    }

    // Handle special switch-to-auto signal
    if (result.type === 'input' && result.value === '__SWITCH_TO_AUTO__') {
      debug('[Runner] Switching to autonomous mode');
      await this.setAutoMode(true);
      // Re-run waiting with controller input
      return;
    }

    // Handle result
    const step = this.moduleSteps[ctx.currentStepIndex];
    const uniqueAgentId = `${step.agentId}-step-${ctx.currentStepIndex}`;

    switch (result.type) {
      case 'input':
        if (result.value === '') {
          // Empty input = advance to next step
          debug('[Runner] Empty input, marking agent completed and advancing');
          this.emitter.updateAgentStatus(uniqueAgentId, 'completed');
          this.emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
          this.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
          // Track step completion for resume
          await markStepCompleted(this.cmRoot, ctx.currentStepIndex);
          this.machine.send({ type: 'INPUT_RECEIVED', input: '' });
        } else {
          // Has input = resume current step with input, then wait again
          await this.resumeWithInput(result.value, result.resumeMonitoringId, result.source);
        }
        break;

      case 'skip':
        debug('[Runner] Skip requested, marking agent skipped');
        this.emitter.updateAgentStatus(uniqueAgentId, 'skipped');
        this.emitter.logMessage(uniqueAgentId, `${step.agentName} was skipped.`);
        this.emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
        // Track step completion for resume
        await markStepCompleted(this.cmRoot, ctx.currentStepIndex);
        this.machine.send({ type: 'SKIP' });
        break;

      case 'stop':
        this.machine.send({ type: 'STOP' });
        break;
    }
  }

  /**
   * Resume current step with input (for chained prompts or steering)
   */
  private async resumeWithInput(input: string, monitoringId?: number, source?: 'user' | 'controller'): Promise<void> {
    const ctx = this.machine.context;
    const step = this.moduleSteps[ctx.currentStepIndex];
    const uniqueAgentId = `${step.agentId}-step-${ctx.currentStepIndex}`;

    debug('[Runner] Resuming step with input: %s... (source=%s)', input.slice(0, 50), source ?? 'user');

    // Get sessionId from step data for resume
    const stepData = await getStepData(this.cmRoot, ctx.currentStepIndex);
    const sessionId = stepData?.sessionId;

    // Detect queued vs custom input
    let isQueuedPrompt = false;
    if (ctx.promptQueue.length > 0 && ctx.promptQueueIndex < ctx.promptQueue.length) {
      const queuedPrompt = ctx.promptQueue[ctx.promptQueueIndex];
      if (input === queuedPrompt.content) {
        isQueuedPrompt = true;
        const chainIndex = ctx.promptQueueIndex;
        ctx.promptQueueIndex += 1;
        debug('[Runner] Advanced queue to index %d', ctx.promptQueueIndex);
        // Track chain completion for resume
        await markChainCompleted(this.cmRoot, ctx.currentStepIndex, chainIndex);
      }
    }

    // Log custom user input (magenta) - skip for controller input (already logged during streaming)
    if (!isQueuedPrompt && source !== 'controller') {
      const formatted = formatUserInput(input);
      this.emitter.logMessage(uniqueAgentId, formatted);
      if (monitoringId !== undefined) {
        AgentLoggerService.getInstance().write(monitoringId, `\n${formatted}\n`);
      }
    }

    this.abortController = new AbortController();
    this.emitter.updateAgentStatus(uniqueAgentId, 'running');
    this.emitter.setWorkflowStatus('running');

    // Track if mode switch was requested during execution
    let modeSwitchRequested: 'manual' | 'auto' | null = null;
    const modeChangeHandler = (data: { autonomousMode: boolean }) => {
      debug('[Runner] Mode change during resumeWithInput: autoMode=%s', data.autonomousMode);
      modeSwitchRequested = data.autonomousMode ? 'auto' : 'manual';
      // Abort the current step execution
      this.abortController?.abort();
    };
    process.on('workflow:mode-change', modeChangeHandler);

    try {
      const output = await executeStep(step, this.cwd, {
        logger: () => {},
        stderrLogger: () => {},
        emitter: this.emitter,
        abortSignal: this.abortController.signal,
        uniqueAgentId,
        resumeMonitoringId: monitoringId,
        resumeSessionId: sessionId,
        resumePrompt: input,
      });

      // Update context with new output
      ctx.currentOutput = {
        output: output.output,
        monitoringId: output.monitoringId,
      };
      ctx.currentMonitoringId = output.monitoringId;

      // Back to checkpoint while waiting for next input
      this.emitter.updateAgentStatus(uniqueAgentId, 'checkpoint');

      // Stay in waiting state - will get more input
      // (The waiting handler will be called again)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (this.pauseRequested) {
          this.machine.send({ type: 'PAUSE' });
          return;
        }
        // Handle mode switch during execution
        if (modeSwitchRequested) {
          debug('[Runner] Step aborted due to mode switch to %s', modeSwitchRequested);
          this.emitter.updateAgentStatus(uniqueAgentId, 'checkpoint');
          await this.setAutoMode(modeSwitchRequested === 'auto');
          // Return to let handleWaiting loop with new provider
          return;
        }
        return;
      }
      this.machine.send({ type: 'STEP_ERROR', error: error as Error });
    } finally {
      process.removeListener('workflow:mode-change', modeChangeHandler);
      this.abortController = null;
    }
  }

  /**
   * Set auto mode on/off
   */
  async setAutoMode(enabled: boolean): Promise<void> {
    const ctx = this.machine.context;

    if (ctx.autoMode === enabled) {
      return;
    }

    debug('[Runner] Setting auto mode: %s', enabled);

    // Deactivate current provider
    this.activeProvider.deactivate?.();

    // Update context
    ctx.autoMode = enabled;

    // Activate new provider
    if (enabled) {
      this.activeProvider = this.controllerInput;
    } else {
      this.activeProvider = this.userInput;
    }
    this.activeProvider.activate?.();
  }

  /**
   * Pause the workflow
   */
  pause(): void {
    this.pauseRequested = true;
    this.abortController?.abort();
  }

  /**
   * Stop the workflow
   */
  stop(): void {
    this.abortController?.abort();
    this.machine.send({ type: 'STOP' });
  }
}
