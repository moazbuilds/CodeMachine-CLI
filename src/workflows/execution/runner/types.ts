/**
 * Workflow Runner Types
 */

import type { ModuleStep, WorkflowTemplate } from '../../templates/types.js';
import type { WorkflowEventEmitter } from '../../events/index.js';
import type { StateMachine } from '../../state/index.js';
import type {
  UserInputProvider,
  ControllerInputProvider,
  InputProvider,
  InputEventEmitter,
} from '../../input/index.js';
import type { DirectiveManager } from '../../directives/index.js';
import type { ControllerConfig } from '../../../shared/workflows/index.js';

/**
 * Runner options (public API)
 */
export interface WorkflowRunnerOptions {
  cwd: string;
  cmRoot: string;
  template: WorkflowTemplate;
  emitter: WorkflowEventEmitter;
  startIndex?: number;
}

/**
 * Runner context passed to extracted functions
 */
export interface RunnerContext {
  readonly machine: StateMachine;
  readonly emitter: WorkflowEventEmitter;
  readonly inputEmitter: InputEventEmitter;
  readonly directiveManager: DirectiveManager;
  readonly moduleSteps: ModuleStep[];
  readonly cwd: string;
  readonly cmRoot: string;

  // Mutable state via getters/setters
  getAbortController(): AbortController | null;
  setAbortController(ac: AbortController | null): void;
  getActiveProvider(): InputProvider;
  setActiveProvider(provider: InputProvider): void;
  getUserInput(): UserInputProvider;
  getControllerInput(): ControllerInputProvider;
  getControllerConfig(): Promise<ControllerConfig | null>;
}
