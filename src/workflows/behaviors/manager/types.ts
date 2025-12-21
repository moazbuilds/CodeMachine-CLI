/**
 * Behavior Manager Types
 *
 * Core interfaces for the behavior system.
 */

import type { WorkflowEventEmitter } from '../../events/emitter.js';
import type { StateMachine } from '../../state/index.js';

/**
 * Supported behavior types
 */
export type BehaviorType = 'pause' | 'skip' | 'stop' | 'mode-change';

/**
 * Current step context - set by runner before each step
 */
export interface StepContext {
  stepIndex: number;
  agentId: string;
  agentName: string;
}

/**
 * Context passed to behaviors during initialization
 */
export interface BehaviorInitContext {
  getAbortController: () => AbortController | null;
  getStepContext: () => StepContext | null;
  emitter: WorkflowEventEmitter;
  machine: StateMachine;
  cwd: string;
  cmRoot: string;
}

/**
 * Context passed to behaviors when handling events
 */
export interface BehaviorContext {
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
 * Result returned from behavior handlers
 */
export interface BehaviorResult {
  handled: boolean;
  action?: 'pause' | 'skip' | 'stop' | 'continue';
  reason?: string;
}

/**
 * Behavior interface - all behaviors must implement this
 */
export interface Behavior {
  /** Unique name for this behavior */
  readonly name: BehaviorType;

  /** Initialize behavior (setup listeners, etc.) */
  init?(context: BehaviorInitContext): void;

  /** Check if behavior is active/triggered */
  isActive?(): boolean;

  /** Trigger/request the behavior */
  trigger?(): void;

  /** Handle the behavior event */
  handle(context: BehaviorContext): Promise<BehaviorResult>;

  /** Reset behavior state (called at step start) */
  reset?(): void;

  /** Cleanup resources (called on workflow end) */
  cleanup?(): void;
}

/**
 * Options for creating a BehaviorManager
 */
export interface BehaviorManagerOptions {
  emitter: WorkflowEventEmitter;
  machine: StateMachine;
  cwd: string;
  cmRoot: string;
}
