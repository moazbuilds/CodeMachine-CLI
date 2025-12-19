/**
 * Workflow Runner
 *
 * Orchestrates workflow execution using:
 * - State machine for state management
 * - Input providers for getting input (user or autopilot)
 * - Step executor for running agents
 *
 * This file is the main orchestrator that delegates to specialized modules:
 * - step-executor.ts: Handles step execution
 * - input-handler.ts: Handles waiting for input and processing results
 * - listeners.ts: Sets up event listeners for workflow control
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
  AutopilotInputProvider,
  createInputEmitter,
  type InputProvider,
  type InputEventEmitter,
} from '../input/index.js';
import { loadAutopilotConfig } from '../../shared/workflows/autopilot.js';
import { getAutopilotModeState } from '../../shared/workflows/steps.js';
import { MonitoringCleanup } from '../../agents/monitoring/cleanup.js';

// Import extracted modules
import { setupListeners } from './listeners.js';
import { executeCurrentStep } from './step-executor.js';
import { handleWaiting } from './input-handler.js';

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
 *
 * Coordinates workflow execution by delegating to specialized modules.
 * Maintains the state machine and input providers.
 */
export class WorkflowRunner {
  private machine: StateMachine;
  private emitter: WorkflowEventEmitter;
  private inputEmitter: InputEventEmitter;

  private userInput: UserInputProvider;
  private autopilotInput: AutopilotInputProvider;
  private activeProvider: InputProvider;

  private cwd: string;
  private cmRoot: string;
  private template: WorkflowTemplate;
  private moduleSteps: ModuleStep[];

  private abortController: AbortController | null = null;
  private pauseRequested = false;
  private sessionStartTime: number = Date.now();

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

    this.autopilotInput = new AutopilotInputProvider({
      emitter: this.inputEmitter,
      getAutopilotConfig: () => this.getAutopilotConfig(),
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
      currentOutput: null,
    });

    // Set up event listeners
    setupListeners({
      machine: this.machine,
      getAbortController: () => this.abortController,
      setPauseRequested: (value) => { this.pauseRequested = value; },
      setAutoMode: (enabled) => this.setAutoMode(enabled),
    });
  }

  private async getAutopilotConfig() {
    const state = await loadAutopilotConfig(this.cmRoot);
    return state?.autopilotConfig ?? null;
  }

  /**
   * Run the workflow
   */
  async run(): Promise<void> {
    debug('[Runner] Starting workflow: %s', this.template.name);

    // Register workflow state with MonitoringCleanup for persistence on pause
    MonitoringCleanup.registerWorkflowState({
      cmRoot: this.cmRoot,
      getAutoMode: () => this.machine.context.autoMode,
      getCurrentStepIndex: () => this.machine.context.currentStepIndex,
      getSessionStartTime: () => this.sessionStartTime,
    });

    // Load initial auto mode state
    const autopilotState = await loadAutopilotConfig(this.cmRoot);
    if (autopilotState?.autonomousMode && autopilotState.autopilotConfig) {
      await this.setAutoMode(true);
    }

    // Check for saved autopilot mode state (from previous pause)
    // This takes precedence over the initial state when resuming
    const savedAutoMode = await getAutopilotModeState(this.cmRoot);
    if (savedAutoMode !== undefined) {
      debug('[Runner] Restoring saved autopilot mode: %s', savedAutoMode);
      await this.setAutoMode(savedAutoMode);
    }

    // Start the machine
    this.machine.send({ type: 'START' });
    this.emitter.setWorkflowStatus('running');

    // Main loop - delegates to specialized handlers
    while (!this.machine.isFinal) {
      const state = this.machine.state;

      if (state === 'running') {
        await executeCurrentStep({
          cwd: this.cwd,
          cmRoot: this.cmRoot,
          emitter: this.emitter,
          machine: this.machine,
          moduleSteps: this.moduleSteps,
          getAbortController: () => this.abortController,
          setAbortController: (c) => { this.abortController = c; },
          isPauseRequested: () => this.pauseRequested,
          resetPauseRequested: () => { this.pauseRequested = false; },
        });
      } else if (state === 'waiting') {
        await handleWaiting({
          cwd: this.cwd,
          cmRoot: this.cmRoot,
          emitter: this.emitter,
          machine: this.machine,
          moduleSteps: this.moduleSteps,
          getActiveProvider: () => this.activeProvider,
          setAutoMode: (enabled) => this.setAutoMode(enabled),
          getAbortController: () => this.abortController,
          setAbortController: (c) => { this.abortController = c; },
          isPauseRequested: () => this.pauseRequested,
        });
      }
    }

    // Final state handling
    this.handleFinalState();
  }

  /**
   * Handle final state after main loop exits
   */
  private handleFinalState(): void {
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
      this.activeProvider = this.autopilotInput;
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
