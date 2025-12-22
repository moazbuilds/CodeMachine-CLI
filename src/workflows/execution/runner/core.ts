/**
 * Workflow Runner
 *
 * Orchestrates workflow execution using:
 * - State machine for state management
 * - Input providers for getting input (user or controller)
 * - Step executor for running agents
 */

import { debug } from '../../../shared/logging/logger.js';
import type { ModuleStep } from '../../templates/types.js';
import type { WorkflowEventEmitter } from '../../events/index.js';
import {
  createWorkflowMachine,
  type StateMachine,
} from '../../state/index.js';
import {
  UserInputProvider,
  ControllerInputProvider,
  createInputEmitter,
  type InputProvider,
  type InputEventEmitter,
} from '../../input/index.js';
import { setAutoMode, createModeListener } from '../../signals/index.js';
import { loadControllerConfig } from '../../../shared/workflows/controller.js';
import { BehaviorManager } from '../../behaviors/index.js';

import type { WorkflowRunnerOptions, RunnerContext } from './types.js';
import { setupListeners } from './listen.js';
import { executeCurrentStep } from './exec.js';
import { handleWaiting } from './wait.js';

/**
 * Workflow runner class
 */
export class WorkflowRunner implements RunnerContext {
  readonly machine: StateMachine;
  readonly emitter: WorkflowEventEmitter;
  readonly inputEmitter: InputEventEmitter;
  readonly behaviorManager: BehaviorManager;
  readonly moduleSteps: ModuleStep[];
  readonly cwd: string;
  readonly cmRoot: string;

  private userInput: UserInputProvider;
  private controllerInput: ControllerInputProvider;
  private activeProvider: InputProvider;
  private abortController: AbortController | null = null;

  constructor(options: WorkflowRunnerOptions) {
    this.cwd = options.cwd;
    this.cmRoot = options.cmRoot;
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
      cmRoot: this.cmRoot,
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
      paused: false,
      currentOutput: null,
    });

    // Create behavior manager (handles pause, skip, etc.)
    this.behaviorManager = new BehaviorManager({
      emitter: this.emitter,
      machine: this.machine,
      cwd: this.cwd,
      cmRoot: this.cmRoot,
    });

    // Set up event listeners
    setupListeners(this);

    // Set up mode listener
    createModeListener({ ctx: this, machine: this.machine });
  }

  // RunnerContext implementation
  getAbortController(): AbortController | null {
    return this.abortController;
  }

  setAbortController(ac: AbortController | null): void {
    this.abortController = ac;
  }

  getActiveProvider(): InputProvider {
    return this.activeProvider;
  }

  setActiveProvider(provider: InputProvider): void {
    this.activeProvider = provider;
  }

  getUserInput(): UserInputProvider {
    return this.userInput;
  }

  getControllerInput(): ControllerInputProvider {
    return this.controllerInput;
  }

  async getControllerConfig() {
    const state = await loadControllerConfig(this.cmRoot);
    return state?.controllerConfig ?? null;
  }

  /**
   * Run the workflow
   */
  async run(): Promise<void> {
    debug('[Runner] Starting workflow');

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

      if (state === 'running') {
        await executeCurrentStep(this);
      } else if (state === 'awaiting') {
        await handleWaiting(this, {
          setAutoMode: (enabled) => this.setAutoMode(enabled),
        });
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
   * Set auto mode on/off
   */
  async setAutoMode(enabled: boolean): Promise<void> {
    await setAutoMode(this, enabled);
  }

  /**
   * Pause the workflow
   */
  pause(): void {
    // Just emit event - behavior handles everything
    (process as NodeJS.EventEmitter).emit('workflow:pause');
  }

  /**
   * Stop the workflow
   */
  stop(): void {
    this.abortController?.abort();
    this.machine.send({ type: 'STOP' });
  }
}
