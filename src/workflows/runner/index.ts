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
import { SignalManager } from '../signals/index.js';
import { loadControllerConfig } from '../../shared/workflows/controller.js';
import type { ActiveLoop } from '../directives/loop/index.js';
import { WorkflowMode } from '../mode/index.js';
import { StepSession } from '../session/index.js';
import { getUniqueAgentId } from '../context/index.js';
import type { StepIndexManager } from '../indexing/index.js';
import { shouldSkipStep, logSkipDebug } from '../step/skip.js';

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
  readonly mode: WorkflowMode;
  readonly indexManager: StepIndexManager;

  private userInput: UserInputProvider;
  private controllerInput: ControllerInputProvider;
  private abortController: AbortController | null = null;
  private loopCounters: Map<string, number> = new Map();
  private activeLoop: ActiveLoop | null = null;
  private _currentSession: StepSession | null = null;

  constructor(options: WorkflowRunnerOptions) {
    this.cwd = options.cwd;
    this.cmRoot = options.cmRoot;
    this.emitter = options.emitter;
    this.template = options.template;
    this.indexManager = options.indexManager;

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
      getUserInput: () => this.userInput,
      cwd: this.cwd,
      cmRoot: this.cmRoot,
      workflowEmitter: this.emitter,
    });

    // Create WorkflowMode (single source of truth for mode state)
    this.mode = new WorkflowMode({
      userInput: this.userInput,
      controllerInput: this.controllerInput,
    });

    // Create state machine
    this.machine = createWorkflowMachine({
      currentStepIndex: options.startIndex ?? 0,
      totalSteps: this.moduleSteps.length,
      steps: this.moduleSteps,
      cwd: this.cwd,
      cmRoot: this.cmRoot,
      autoMode: false,
      paused: false,
      currentOutput: null,
    });

    // Create signal manager (handles pause, skip, stop, mode-change)
    this.signalManager = new SignalManager({
      emitter: this.emitter,
      machine: this.machine,
      mode: this.mode,
      cwd: this.cwd,
      cmRoot: this.cmRoot,
      indexManager: this.indexManager,
    });

    // Set mode context for mode switching (delegates to WorkflowMode)
    this.signalManager.setModeContext({
      getActiveProvider: () => this.mode.getActiveProvider(),
      setActiveProvider: () => {
        // No-op: WorkflowMode manages provider selection internally
      },
      getUserInput: () => this.mode.getUserInput(),
      getControllerInput: () => this.mode.getControllerInput(),
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
    return this.mode.getActiveProvider();
  }

  setActiveProvider(_provider: InputProvider): void {
    // No-op: WorkflowMode manages provider selection internally
    // This method is kept for interface compatibility
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

  getCurrentSession(): StepSession | null {
    return this._currentSession;
  }

  setCurrentSession(session: StepSession | null): void {
    this._currentSession = session;
  }

  /**
   * Create a new StepSession for the current step
   */
  createSession(): StepSession {
    const stepIndex = this.machine.context.currentStepIndex;
    const step = this.moduleSteps[stepIndex];
    const uniqueAgentId = getUniqueAgentId(step, stepIndex);

    const session = new StepSession({
      stepIndex,
      step,
      cwd: this.cwd,
      cmRoot: this.cmRoot,
      emitter: this.emitter,
      uniqueAgentId,
      indexManager: this.indexManager,
    });

    this._currentSession = session;
    return session;
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
    // autoMode can work without controller for non-interactive steps (Scenarios 5-6)
    // For interactive steps without controller, controller provider delegates to user input
    const controllerState = await loadControllerConfig(this.cmRoot);
    if (controllerState?.autonomousMode) {
      this.mode.enableAutoMode();
      // Sync machine context with mode state
      this.machine.context.autoMode = true;
    }

    // Start the machine
    this.machine.send({ type: 'START' });
    this.emitter.setWorkflowStatus('running');

    // Main loop
    while (!this.machine.isFinal) {
      const state = this.machine.state;

      if (state === 'running') {
        const stepIndex = this.machine.context.currentStepIndex;
        const step = this.moduleSteps[stepIndex];
        const uniqueAgentId = getUniqueAgentId(step, stepIndex);

        // Log skip debug info for loops
        logSkipDebug(step, stepIndex, this.activeLoop);

        // Check if step should be skipped (executeOnce, loop skip list)
        const skipResult = await shouldSkipStep({
          step,
          index: stepIndex,
          activeLoop: this.activeLoop,
          indexManager: this.indexManager,
          uniqueAgentId,
          emitter: this.emitter,
        });

        if (skipResult.skip) {
          debug('[Runner] Skipping step %d: %s', stepIndex, skipResult.reason);
          this.machine.send({ type: 'SKIP' });
          continue;
        }

        // Create new session for this step
        const session = this.createSession();
        session.markRunning();
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
    this.mode.setAutoMode(enabled);
    // Sync machine context with mode state
    this.machine.context.autoMode = enabled;
  }

  /**
   * Pause the workflow
   */
  pause(): void {
    // Sync mode state
    this.mode.pause();
    // Sync session state
    if (this._currentSession) {
      this._currentSession.markAwaiting();
    }
    // Just emit event - SignalManager handles state machine transition
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
