/**
 * Signal Manager Types
 *
 * Core interfaces for the signal management system.
 */

import type { WorkflowEventEmitter } from '../../events/emitter.js';
import type { StateMachine } from '../../state/index.js';
import type { InputProvider } from '../../input/types.js';
import type { WorkflowMode } from '../../mode/index.js';
import type { StepIndexManager } from '../../indexing/index.js';

/**
 * Supported signal types
 */
export type SignalType = 'pause' | 'skip' | 'stop' | 'mode-change';

/**
 * Input mode - determines where input comes from
 */
export type InputMode = 'user' | 'auto';

/**
 * Current step context - set by runner before each step
 */
export interface StepContext {
  stepIndex: number;
  agentId: string;
  agentName: string;
}

/**
 * Context required for mode switching
 * Runner implements this interface
 */
export interface ModeSwitchContext {
  readonly machine: StateMachine;
  getActiveProvider(): InputProvider;
  setActiveProvider(provider: InputProvider): void;
  getUserInput(): InputProvider;
  getControllerInput(): InputProvider;
}

/**
 * Context available to signal handlers
 */
export interface SignalContext extends ModeSwitchContext {
  readonly emitter: WorkflowEventEmitter;
  readonly cwd: string;
  readonly cmRoot: string;
  readonly mode: WorkflowMode;
  readonly indexManager: StepIndexManager;
  getAbortController(): AbortController | null;
  getStepContext(): StepContext | null;
}

/**
 * Options for creating a SignalManager
 */
export interface SignalManagerOptions {
  emitter: WorkflowEventEmitter;
  machine: StateMachine;
  mode: WorkflowMode;
  cwd: string;
  cmRoot: string;
  indexManager: StepIndexManager;
}
