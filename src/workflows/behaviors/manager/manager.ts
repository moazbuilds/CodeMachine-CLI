/**
 * Behavior Manager
 *
 * Central coordinator for all workflow behaviors.
 * Runner only knows about the manager, not individual behaviors.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { WorkflowEventEmitter } from '../../events/emitter.js';
import type { StateMachine } from '../../state/index.js';
import type {
  Behavior,
  BehaviorType,
  BehaviorContext,
  BehaviorResult,
  BehaviorManagerOptions,
  BehaviorInitContext,
  StepContext,
} from './types.js';
import { PauseBehavior } from '../pause/handler.js';

/**
 * BehaviorManager - orchestrates all workflow behaviors
 */
export class BehaviorManager {
  private behaviors: Map<BehaviorType, Behavior> = new Map();
  private emitter: WorkflowEventEmitter;
  private machine: StateMachine;
  private cwd: string;
  private cmRoot: string;
  private abortController: AbortController | null = null;
  private stepContext: StepContext | null = null;

  constructor(options: BehaviorManagerOptions) {
    this.emitter = options.emitter;
    this.machine = options.machine;
    this.cwd = options.cwd;
    this.cmRoot = options.cmRoot;

    // Register built-in behaviors
    this.registerBuiltInBehaviors();

    // Initialize all behaviors
    this.initAll();
  }

  /**
   * Register built-in behaviors
   */
  private registerBuiltInBehaviors(): void {
    this.register(new PauseBehavior());
    // Future: this.register(new SkipBehavior());
    // Future: this.register(new StopBehavior());
  }

  /**
   * Initialize all behaviors
   */
  private initAll(): void {
    const initContext: BehaviorInitContext = {
      getAbortController: () => this.abortController,
      getStepContext: () => this.stepContext,
      emitter: this.emitter,
      machine: this.machine,
      cwd: this.cwd,
      cmRoot: this.cmRoot,
    };

    for (const behavior of this.behaviors.values()) {
      behavior.init?.(initContext);
    }
  }

  /**
   * Register a behavior
   */
  register(behavior: Behavior): void {
    debug('[BehaviorManager] Registering behavior: %s', behavior.name);
    this.behaviors.set(behavior.name, behavior);
  }

  /**
   * Get a registered behavior by type
   */
  get<T extends Behavior>(type: BehaviorType): T | undefined {
    return this.behaviors.get(type) as T | undefined;
  }

  /**
   * Set the current abort controller (called by runner)
   */
  setAbortController(controller: AbortController | null): void {
    this.abortController = controller;
  }

  /**
   * Get the current abort controller
   */
  getAbortController(): AbortController | null {
    return this.abortController;
  }

  /**
   * Set current step context (called by runner before each step)
   */
  setStepContext(context: StepContext | null): void {
    this.stepContext = context;
  }

  /**
   * Get current step context
   */
  getStepContext(): StepContext | null {
    return this.stepContext;
  }

  /**
   * Handle a behavior event
   */
  async handle(
    type: BehaviorType,
    partialContext: Partial<BehaviorContext> & { stepIndex: number; agentId: string; agentName: string }
  ): Promise<BehaviorResult> {
    const behavior = this.behaviors.get(type);

    if (!behavior) {
      debug('[BehaviorManager] No behavior registered for: %s', type);
      return { handled: false };
    }

    const context: BehaviorContext = {
      cwd: this.cwd,
      cmRoot: this.cmRoot,
      emitter: this.emitter,
      machine: this.machine,
      abortController: this.abortController,
      ...partialContext,
    };

    debug('[BehaviorManager] Handling behavior: %s', type);
    return behavior.handle(context);
  }

  /**
   * Reset all behaviors (called at step start)
   */
  resetAll(): void {
    debug('[BehaviorManager] Resetting all behaviors');
    for (const behavior of this.behaviors.values()) {
      behavior.reset?.();
    }
  }

  /**
   * Cleanup all behaviors (called on workflow end)
   */
  cleanup(): void {
    debug('[BehaviorManager] Cleaning up all behaviors');
    for (const behavior of this.behaviors.values()) {
      behavior.cleanup?.();
    }
    this.behaviors.clear();
  }
}
