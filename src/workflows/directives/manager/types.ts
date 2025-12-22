/**
 * Directive Manager Types
 *
 * Core interfaces for the directive system.
 */

import type { WorkflowEventEmitter } from '../../events/emitter.js';
import type { StateMachine } from '../../state/index.js';

/**
 * Supported directive types
 */
export type DirectiveType = 'pause' | 'skip' | 'stop' | 'mode-change';

/**
 * Current step context - set by runner before each step
 */
export interface StepContext {
  stepIndex: number;
  agentId: string;
  agentName: string;
}

/**
 * Context passed to directives during initialization
 */
export interface DirectiveInitContext {
  getAbortController: () => AbortController | null;
  getStepContext: () => StepContext | null;
  emitter: WorkflowEventEmitter;
  machine: StateMachine;
  cwd: string;
  cmRoot: string;
}

/**
 * Context passed to directives when handling events
 */
export interface DirectiveContext {
  cwd: string;
  cmRoot: string;
  stepIndex: number;
  agentId: string;
  agentName: string;
  abortController: AbortController | null;
  emitter: WorkflowEventEmitter;
  machine: StateMachine;
}

/**
 * Result returned from directive handlers
 */
export interface DirectiveResult {
  handled: boolean;
  action?: 'pause' | 'skip' | 'stop' | 'continue';
  reason?: string;
}

/**
 * Directive interface - all directives must implement this
 */
export interface Directive {
  /** Unique name for this directive */
  readonly name: DirectiveType;

  /** Initialize directive (setup listeners, etc.) */
  init?(context: DirectiveInitContext): void;

  /** Check if directive is active/triggered */
  isActive?(): boolean;

  /** Trigger/request the directive */
  trigger?(): void;

  /** Handle the directive event */
  handle(context: DirectiveContext): Promise<DirectiveResult>;

  /** Reset directive state (called at step start) */
  reset?(): void;

  /** Cleanup resources (called on workflow end) */
  cleanup?(): void;
}

/**
 * Options for creating a DirectiveManager
 */
export interface DirectiveManagerOptions {
  emitter: WorkflowEventEmitter;
  machine: StateMachine;
  cwd: string;
  cmRoot: string;
}
