/**
 * Workflow Runner
 *
 * Orchestrates workflow execution using:
 * - State machine for state management
 * - Input providers for getting input (user or controller)
 * - Step executor for running agents
 */

import { debug } from '../../shared/logging/logger.js';
import type { ModuleStep, WorkflowTemplate } from '../templates/types.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import {
  createWorkflowMachine,
  type StateMachine,
} from '../state/index.js';
import {
  UserInputProvider,
  ControllerInputProvider,
  createInputEmitter,
  type InputProvider,
  type InputEventEmitter,
} from '../input/index.js';
import { SignalManager, setAutoMode } from '../signals/index.js';
import { loadControllerConfig } from '../../shared/workflows/controller.js';
import type { ActiveLoop } from '../directives/loop/index.js';

import type { WorkflowRunnerOptions, RunnerContext } from './types.js';
import { runStepFresh } from '../step/run.js';
import { handleWaiting } from './wait.js';

export type { WorkflowRunnerOptions, RunnerContext } from './types.js';
export { handleWaiting } from './wait.js';
export * from './resume.js';

/**
 * Workflow runner class
 */
export class WorkflowRunner implements RunnerContext {
  readonly machine: StateMachine;
  readonly emitter: WorkflowEventEmitter;
  readonly inputEmitter: InputEventEmitter;
  readonly signalManager: SignalManager;
  readonly moduleSteps: ModuleStep[];
  readonly cwd: string;
  readonly cmRoot: string;
  readonly template: WorkflowTemplate;

  private userInput: UserInputProvider;
  private controllerInput: ControllerInputProvider;
  private activeProvider: InputProvider;
  private abortController: AbortController | null = null;
  private loopCounters: Map<string, number> = new Map();
  private activeLoop: ActiveLoop | null = null;

  constructor(options: WorkflowRunnerOptions) {
    this.cwd = options.cwd;
    this.cmRoot = options.cmRoot;
    this.emitter = options.emitter;
    this.template = options.template;

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
      workflowEmitter: this.emitter,
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

    // Create signal manager (handles pause, skip, stop, mode-change)
    this.signalManager = new SignalManager({
      emitter: this.emitter,
      machine: this.machine,
      cwd: this.cwd,
      cmRoot: this.cmRoot,
    });

    // Set mode context for mode switching
    this.signalManager.setModeContext({
      getActiveProvider: () => this.activeProvider,
      setActiveProvider: (p) => {
        this.activeProvider = p;
      },
      getUserInput: () => this.userInput,
      getControllerInput: () => this.controllerInput,
    });

    // Initialize all signal listeners
    this.signalManager.init();
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

  getLoopCounters(): Map<string, number> {
    return this.loopCounters;
  }

  getActiveLoop(): ActiveLoop | null {
    return this.activeLoop;
  }

  setActiveLoop(loop: ActiveLoop | null): void {
    this.activeLoop = loop;
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
        await runStepFresh(this);
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
    // Just emit event - SignalManager handles everything
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
