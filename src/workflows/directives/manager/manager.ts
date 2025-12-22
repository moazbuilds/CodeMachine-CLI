/**
 * Directive Manager
 *
 * Central coordinator for all workflow directives.
 * Runner only knows about the manager, not individual directives.
 */

import { debug } from '../../../shared/logging/logger.js';
import type { WorkflowEventEmitter } from '../../events/emitter.js';
import type { StateMachine } from '../../state/index.js';
import type {
  Directive,
  DirectiveType,
  DirectiveContext,
  DirectiveResult,
  DirectiveManagerOptions,
  DirectiveInitContext,
  StepContext,
} from './types.js';
import { PauseDirective } from '../pause/handler.js';

/**
 * DirectiveManager - orchestrates all workflow directives
 */
export class DirectiveManager {
  private directives: Map<DirectiveType, Directive> = new Map();
  private emitter: WorkflowEventEmitter;
  private machine: StateMachine;
  private cwd: string;
  private cmRoot: string;
  private abortController: AbortController | null = null;
  private stepContext: StepContext | null = null;

  constructor(options: DirectiveManagerOptions) {
    this.emitter = options.emitter;
    this.machine = options.machine;
    this.cwd = options.cwd;
    this.cmRoot = options.cmRoot;

    // Register built-in directives
    this.registerBuiltInDirectives();

    // Initialize all directives
    this.initAll();
  }

  /**
   * Register built-in directives
   */
  private registerBuiltInDirectives(): void {
    this.register(new PauseDirective());
    // Future: this.register(new SkipDirective());
    // Future: this.register(new StopDirective());
  }

  /**
   * Initialize all directives
   */
  private initAll(): void {
    const initContext: DirectiveInitContext = {
      getAbortController: () => this.abortController,
      getStepContext: () => this.stepContext,
      emitter: this.emitter,
      machine: this.machine,
      cwd: this.cwd,
      cmRoot: this.cmRoot,
    };

    for (const directive of this.directives.values()) {
      directive.init?.(initContext);
    }
  }

  /**
   * Register a directive
   */
  register(directive: Directive): void {
    debug('[DirectiveManager] Registering directive: %s', directive.name);
    this.directives.set(directive.name, directive);
  }

  /**
   * Get a registered directive by type
   */
  get<T extends Directive>(type: DirectiveType): T | undefined {
    return this.directives.get(type) as T | undefined;
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
   * Handle a directive event
   */
  async handle(
    type: DirectiveType,
    partialContext: Partial<DirectiveContext> & { stepIndex: number; agentId: string; agentName: string }
  ): Promise<DirectiveResult> {
    const directive = this.directives.get(type);

    if (!directive) {
      debug('[DirectiveManager] No directive registered for: %s', type);
      return { handled: false };
    }

    const context: DirectiveContext = {
      cwd: this.cwd,
      cmRoot: this.cmRoot,
      emitter: this.emitter,
      machine: this.machine,
      abortController: this.abortController,
      ...partialContext,
    };

    debug('[DirectiveManager] Handling directive: %s', type);
    return directive.handle(context);
  }

  /**
   * Reset all directives (called at step start)
   */
  resetAll(): void {
    debug('[DirectiveManager] Resetting all directives');
    for (const directive of this.directives.values()) {
      directive.reset?.();
    }
  }

  /**
   * Cleanup all directives (called on workflow end)
   */
  cleanup(): void {
    debug('[DirectiveManager] Cleaning up all directives');
    for (const directive of this.directives.values()) {
      directive.cleanup?.();
    }
    this.directives.clear();
  }
}
