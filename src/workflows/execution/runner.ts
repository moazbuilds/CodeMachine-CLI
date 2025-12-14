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
import { formatAgentLog } from '../../shared/logging/index.js';
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
      await this.setAutoMode(data.autonomousMode);
    };
    process.on('workflow:mode-change', modeChangeHandler);

    // Clean up on machine final state
    this.machine.subscribe((state) => {
      if (this.machine.isFinal) {
        process.removeListener('workflow:pause', pauseHandler);
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

    // Reset pause flag
    this.pauseRequested = false;

    // Set up abort controller
    this.abortController = new AbortController();

    // Update UI
    this.emitter.updateAgentStatus(uniqueAgentId, 'running');
    this.emitter.logMessage(uniqueAgentId, '═'.repeat(80));
    this.emitter.logMessage(uniqueAgentId, `${step.agentName} started to work.`);

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
      // Execute the step
      const output = await executeStep(step, this.cwd, {
        logger: () => {},
        stderrLogger: () => {},
        emitter: this.emitter,
        abortSignal: this.abortController.signal,
        uniqueAgentId,
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
      this.emitter.updateAgentStatus(uniqueAgentId, 'completed');

      const stepOutput: StepOutput = {
        output: output.output,
        monitoringId: output.monitoringId,
      };

      // Update context with chained prompts if any
      if (output.chainedPrompts && output.chainedPrompts.length > 0) {
        this.machine.context.promptQueue = output.chainedPrompts;
        this.machine.context.promptQueueIndex = 0;
      } else {
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
          // Treat skip as completing the step with empty output
          this.machine.send({
            type: 'STEP_COMPLETE',
            output: { output: '', monitoringId: undefined },
          });
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

    debug('[Runner] Handling waiting state, autoMode=%s', ctx.autoMode);

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

    // Handle result
    switch (result.type) {
      case 'input':
        if (result.value === '') {
          // Empty input = advance to next step
          this.machine.send({ type: 'INPUT_RECEIVED', input: '' });
        } else {
          // Has input = resume current step with input, then wait again
          await this.resumeWithInput(result.value, result.resumeMonitoringId);
        }
        break;

      case 'skip':
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
  private async resumeWithInput(input: string, monitoringId?: number): Promise<void> {
    const ctx = this.machine.context;
    const step = this.moduleSteps[ctx.currentStepIndex];
    const uniqueAgentId = `${step.agentId}-step-${ctx.currentStepIndex}`;

    debug('[Runner] Resuming step with input: %s...', input.slice(0, 50));

    // Update queue index if using queued prompt
    if (ctx.promptQueue.length > 0 && ctx.promptQueueIndex < ctx.promptQueue.length) {
      const queuedPrompt = ctx.promptQueue[ctx.promptQueueIndex];
      if (input === queuedPrompt.content) {
        ctx.promptQueueIndex += 1;
        debug('[Runner] Advanced queue to index %d', ctx.promptQueueIndex);
      }
    }

    this.abortController = new AbortController();
    this.emitter.updateAgentStatus(uniqueAgentId, 'running');
    this.emitter.setWorkflowStatus('running');

    try {
      const output = await executeStep(step, this.cwd, {
        logger: () => {},
        stderrLogger: () => {},
        emitter: this.emitter,
        abortSignal: this.abortController.signal,
        uniqueAgentId,
        resumeMonitoringId: monitoringId,
        resumePrompt: input,
      });

      // Update context with new output
      ctx.currentOutput = {
        output: output.output,
        monitoringId: output.monitoringId,
      };
      ctx.currentMonitoringId = output.monitoringId;

      // Stay in waiting state - will get more input
      // (The waiting handler will be called again)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (this.pauseRequested) {
          this.machine.send({ type: 'PAUSE' });
        }
        return;
      }
      this.machine.send({ type: 'STEP_ERROR', error: error as Error });
    } finally {
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
