/**
 * Signal Manager
 *
 * Central coordinator for all workflow signals (user-initiated events).
 * Sets up ALL process.on() listeners in init().
 * Provides context (abortController, stepContext) to handlers.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { WorkflowEventEmitter } from '../../events/emitter.js';
import type { StateMachine } from '../../state/index.js';
import type { InputProvider } from '../../input/types.js';
import type { WorkflowMode } from '../../mode/index.js';
import type { StepIndexManager } from '../../indexing/index.js';
import type {
  SignalManagerOptions,
  StepContext,
  SignalContext,
} from './types.js';

// Import handlers
import { handlePauseSignal } from '../handlers/pause.js';
import { handleSkipSignal } from '../handlers/skip.js';
import { handleStopSignal } from '../handlers/stop.js';
import { handleModeChangeSignal } from '../handlers/mode.js';

/**
 * SignalManager - central coordinator for all workflow signals
 */
export class SignalManager implements SignalContext {
  readonly machine: StateMachine;
  readonly emitter: WorkflowEventEmitter;
  readonly mode: WorkflowMode;
  readonly cwd: string;
  readonly cmRoot: string;
  readonly indexManager: StepIndexManager;

  private abortController: AbortController | null = null;
  private stepContext: StepContext | null = null;
  private cleanupFns: (() => void)[] = [];

  // Mode switching context (set by runner via setModeContext)
  // Kept for backwards compatibility, but WorkflowMode is the source of truth
  private activeProviderGetter: (() => InputProvider) | null = null;
  private activeProviderSetter: ((p: InputProvider) => void) | null = null;
  private userInputGetter: (() => InputProvider) | null = null;
  private controllerInputGetter: (() => InputProvider) | null = null;

  constructor(options: SignalManagerOptions) {
    this.emitter = options.emitter;
    this.machine = options.machine;
    this.mode = options.mode;
    this.cwd = options.cwd;
    this.cmRoot = options.cmRoot;
    this.indexManager = options.indexManager;
  }

  /**
   * Initialize all signal listeners
   * Called by runner after construction
   */
  init(): void {
    debug('[SignalManager] Initializing all signal listeners');

    // Pause signal (Ctrl+P or 'p' key)
    const pauseHandler = () => {
      handlePauseSignal(this).catch(err =>
        debug('[SignalManager] Pause handler error: %s', err.message)
      );
    };
    process.on('workflow:pause', pauseHandler);
    this.cleanupFns.push(() =>
      process.removeListener('workflow:pause', pauseHandler)
    );

    // Skip signal (Ctrl+S while agent running)
    const skipHandler = () => {
      handleSkipSignal(this).catch(err =>
        debug('[SignalManager] Skip handler error: %s', err.message)
      );
    };
    process.on('workflow:skip', skipHandler);
    this.cleanupFns.push(() =>
      process.removeListener('workflow:skip', skipHandler)
    );

    // Stop signal
    const stopHandler = () => handleStopSignal(this);
    process.on('workflow:stop', stopHandler);
    this.cleanupFns.push(() =>
      process.removeListener('workflow:stop', stopHandler)
    );

    // Mode change signal
    const modeHandler = (data: { autonomousMode: boolean }) =>
      handleModeChangeSignal(this, data);
    process.on('workflow:mode-change', modeHandler);
    this.cleanupFns.push(() =>
      process.removeListener('workflow:mode-change', modeHandler)
    );

    debug('[SignalManager] All listeners registered');
  }

  /**
   * Set mode switching context (called by runner)
   */
  setModeContext(ctx: {
    getActiveProvider: () => InputProvider;
    setActiveProvider: (p: InputProvider) => void;
    getUserInput: () => InputProvider;
    getControllerInput: () => InputProvider;
  }): void {
    this.activeProviderGetter = ctx.getActiveProvider;
    this.activeProviderSetter = ctx.setActiveProvider;
    this.userInputGetter = ctx.getUserInput;
    this.controllerInputGetter = ctx.getControllerInput;
  }

  // SignalContext implementation - mode switching
  getActiveProvider(): InputProvider {
    if (!this.activeProviderGetter) throw new Error('Mode context not set');
    return this.activeProviderGetter();
  }

  setActiveProvider(provider: InputProvider): void {
    if (!this.activeProviderSetter) throw new Error('Mode context not set');
    this.activeProviderSetter(provider);
  }

  getUserInput(): InputProvider {
    if (!this.userInputGetter) throw new Error('Mode context not set');
    return this.userInputGetter();
  }

  getControllerInput(): InputProvider {
    if (!this.controllerInputGetter) throw new Error('Mode context not set');
    return this.controllerInputGetter();
  }

  // SignalContext implementation - abort/step context
  getAbortController(): AbortController | null {
    return this.abortController;
  }

  getStepContext(): StepContext | null {
    return this.stepContext;
  }

  /**
   * Set the current abort controller (called by step/hooks.ts)
   */
  setAbortController(controller: AbortController | null): void {
    this.abortController = controller;
  }

  /**
   * Set current step context (called by step/hooks.ts before each step)
   */
  setStepContext(context: StepContext | null): void {
    this.stepContext = context;
  }

  /**
   * Reset state (called at step start by step/hooks.ts)
   */
  resetAll(): void {
    debug('[SignalManager] Resetting state');
    // Step context and abort controller are set explicitly by step/hooks.ts
    // No additional reset needed
  }

  /**
   * Cleanup all listeners (called on workflow end)
   */
  cleanup(): void {
    debug('[SignalManager] Cleaning up all listeners');
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];
  }
}
