/**
 * Workflow State Machine
 *
 * Finite state machine implementation for workflow execution.
 * Ensures valid state transitions and prevents race conditions.
 *
 * Note: Queue state (promptQueue, promptQueueIndex) is managed by StepIndexManager.
 * The context fields are kept for backward compatibility during transition.
 * StepSession syncs between indexManager and machine context.
 */

import { debug } from '../../shared/logging/logger.js';
import type {
  WorkflowState,
  WorkflowEvent,
  WorkflowContext,
  StateMachine,
  StateListener,
  MachineConfig,
  Transition,
} from './types.js';

/**
 * Create a workflow state machine
 */
export function createMachine(config: MachineConfig): StateMachine {
  let currentState: WorkflowState = config.initial;
  const context: WorkflowContext = { ...config.context };
  const listeners = new Set<StateListener>();

  const FINAL_STATES: WorkflowState[] = ['completed', 'stopped', 'error'];

  function notify() {
    for (const listener of listeners) {
      listener(currentState, context);
    }
  }

  function findTransition(eventType: WorkflowEvent['type']): Transition | null {
    const stateDef = config.states[currentState];
    if (!stateDef.on) return null;

    const transitions = stateDef.on[eventType];
    if (!transitions) return null;

    // Handle single transition or array
    const transitionList = Array.isArray(transitions) ? transitions : [transitions];

    // Find first transition where guard passes (or no guard)
    for (const transition of transitionList) {
      if (!transition.guard || transition.guard(context)) {
        return transition;
      }
    }

    return null;
  }

  function send(event: WorkflowEvent): void {
    if (FINAL_STATES.includes(currentState)) {
      debug('[FSM] Ignoring event %s - machine in final state %s', event.type, currentState);
      return;
    }

    const transition = findTransition(event.type);
    if (!transition) {
      debug('[FSM] No valid transition for event %s in state %s', event.type, currentState);
      return;
    }

    const prevState = currentState;
    const nextState = transition.target;

    debug('[FSM] Transition: %s -> %s (event: %s)', prevState, nextState, event.type);

    // Exit current state
    const prevStateDef = config.states[prevState];
    if (prevStateDef.onExit) {
      prevStateDef.onExit(context);
    }

    // Execute transition action
    if (transition.action) {
      transition.action(context, event);
    }

    // Enter new state
    currentState = nextState;
    const nextStateDef = config.states[nextState];
    if (nextStateDef.onEnter) {
      nextStateDef.onEnter(context);
    }

    notify();
  }

  function subscribe(listener: StateListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    get state() {
      return currentState;
    },
    get context() {
      return context;
    },
    get isFinal() {
      return FINAL_STATES.includes(currentState);
    },
    send,
    subscribe,
  };
}

/**
 * Create the workflow state machine with default configuration
 */
export function createWorkflowMachine(initialContext: Partial<WorkflowContext> = {}): StateMachine {
  const defaultContext: WorkflowContext = {
    currentStepIndex: 0,
    totalSteps: 0,
    steps: [],
    currentOutput: null,
    autoMode: false,
    paused: false,
    cwd: process.cwd(),
    cmRoot: '',
    continuationPromptSent: false,
    ...initialContext,
  };

  return createMachine({
    id: 'workflow',
    initial: 'idle',
    context: defaultContext,
    states: {
      idle: {
        on: {
          START: {
            target: 'running',
            action: (ctx) => {
              debug('[FSM] Workflow started with %d steps', ctx.totalSteps);
            },
          },
        },
      },

      running: {
        onEnter: (ctx) => {
          debug('[FSM] Entering running state, step %d/%d', ctx.currentStepIndex + 1, ctx.totalSteps);
        },
        on: {
          STEP_COMPLETE: [
            // Controller mode -> delegated state
            {
              target: 'delegated',
              guard: (ctx) => {
                const step = ctx.steps[ctx.currentStepIndex];
                return ctx.autoMode && !ctx.paused && step?.interactive !== false;
              },
              action: (ctx, event) => {
                if (event.type === 'STEP_COMPLETE') {
                  ctx.currentOutput = event.output;
                  ctx.currentMonitoringId = event.output.monitoringId;
                  ctx.continuationPromptSent = true; // Fresh completion - no continuation prompt needed
                  debug('[FSM] Step completed (delegated), output length: %d', event.output.output.length);
                }
              },
            },
            // Manual mode -> awaiting state
            {
              target: 'awaiting',
              action: (ctx, event) => {
                if (event.type === 'STEP_COMPLETE') {
                  ctx.currentOutput = event.output;
                  ctx.currentMonitoringId = event.output.monitoringId;
                  debug('[FSM] Step completed (awaiting), output length: %d', event.output.output.length);
                }
              },
            },
          ],
          STEP_ERROR: {
            target: 'error',
            action: (ctx, event) => {
              if (event.type === 'STEP_ERROR') {
                ctx.lastError = event.error;
                debug('[FSM] Step error: %s', event.error.message);
              }
            },
          },
          SKIP: [
            // Skip while running - advance to next step
            // Note: Queue reset is handled by StepIndexManager
            {
              target: 'running',
              guard: (ctx) => ctx.currentStepIndex < ctx.totalSteps - 1,
              action: (ctx) => {
                ctx.currentStepIndex += 1;
                ctx.continuationPromptSent = false;
                debug('[FSM] Skipped during run, advancing to step %d', ctx.currentStepIndex + 1);
              },
            },
            // If last step, complete
            {
              target: 'completed',
              guard: (ctx) => ctx.currentStepIndex >= ctx.totalSteps - 1,
            },
          ],
          PAUSE: {
            target: 'awaiting',
            action: (ctx) => {
              // Pause forces manual mode and sets paused flag
              ctx.autoMode = false;
              ctx.paused = true;
              debug('[FSM] Paused - auto mode disabled');
            },
          },
          STOP: {
            target: 'stopped',
          },
        },
      },

      awaiting: {
        onEnter: (ctx) => {
          debug('[FSM] Entering awaiting state, autoMode: %s', ctx.autoMode);
        },
        on: {
          DELEGATE: {
            target: 'delegated',
            action: (ctx) => {
              ctx.autoMode = true;
              debug('[FSM] Mode switched to autonomous, transitioning to delegated');
            },
          },
          RESUME: {
            target: 'running',
            action: () => {
              debug('[FSM] Resuming execution from awaiting state');
            },
          },
          INPUT_RECEIVED: [
            // If more steps, go to running
            {
              target: 'running',
              guard: (ctx) => ctx.currentStepIndex < ctx.totalSteps - 1,
              action: (ctx, event) => {
                if (event.type === 'INPUT_RECEIVED') {
                  ctx.currentStepIndex += 1;
                  ctx.continuationPromptSent = false;
                  debug('[FSM] Input received, advancing to step %d', ctx.currentStepIndex + 1);
                }
              },
            },
            // If last step, go to completed
            {
              target: 'completed',
              guard: (ctx) => ctx.currentStepIndex >= ctx.totalSteps - 1,
              action: () => {
                debug('[FSM] Last step completed');
              },
            },
          ],
          SKIP: [
            // If more steps, skip to next
            // Note: Queue reset is handled by StepIndexManager
            {
              target: 'running',
              guard: (ctx) => ctx.currentStepIndex < ctx.totalSteps - 1,
              action: (ctx) => {
                ctx.currentStepIndex += 1;
                ctx.continuationPromptSent = false;
                debug('[FSM] Skipped, advancing to step %d', ctx.currentStepIndex + 1);
              },
            },
            // If last step, complete
            {
              target: 'completed',
              guard: (ctx) => ctx.currentStepIndex >= ctx.totalSteps - 1,
            },
          ],
          STOP: {
            target: 'stopped',
          },
        },
      },

      delegated: {
        onEnter: () => {
          debug('[FSM] Entering delegated state (controller agent)');
        },
        on: {
          AWAIT: {
            target: 'awaiting',
            action: (ctx) => {
              ctx.autoMode = false;
              ctx.continuationPromptSent = false; // Reset so next auto mode entry sends prompt
              debug('[FSM] Mode switched to manual, transitioning to awaiting');
            },
          },
          INPUT_RECEIVED: [
            {
              target: 'running',
              guard: (ctx) => ctx.currentStepIndex < ctx.totalSteps - 1,
              action: (ctx, event) => {
                if (event.type === 'INPUT_RECEIVED') {
                  ctx.currentStepIndex += 1;
                  ctx.continuationPromptSent = false;
                  debug('[FSM] Controller input received, advancing to step %d', ctx.currentStepIndex + 1);
                }
              },
            },
            {
              target: 'completed',
              guard: (ctx) => ctx.currentStepIndex >= ctx.totalSteps - 1,
              action: () => {
                debug('[FSM] Last step completed (delegated)');
              },
            },
          ],
          SKIP: [
            {
              target: 'running',
              guard: (ctx) => ctx.currentStepIndex < ctx.totalSteps - 1,
              action: (ctx) => {
                ctx.currentStepIndex += 1;
                ctx.continuationPromptSent = false;
                debug('[FSM] Controller skipped, advancing to step %d', ctx.currentStepIndex + 1);
              },
            },
            {
              target: 'completed',
              guard: (ctx) => ctx.currentStepIndex >= ctx.totalSteps - 1,
            },
          ],
          PAUSE: {
            target: 'awaiting',
            action: (ctx) => {
              ctx.autoMode = false;
              ctx.paused = true;
              ctx.continuationPromptSent = false; // Reset so next auto mode entry sends prompt
              debug('[FSM] Controller paused - switching to manual mode');
            },
          },
          STOP: {
            target: 'stopped',
          },
        },
      },

      completed: {
        onEnter: () => {
          debug('[FSM] Workflow completed');
        },
      },

      stopped: {
        onEnter: () => {
          debug('[FSM] Workflow stopped');
        },
      },

      error: {
        onEnter: (ctx) => {
          debug('[FSM] Workflow error: %s', ctx.lastError?.message);
        },
      },
    },
  });
}
