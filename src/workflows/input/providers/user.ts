/**
 * User Input Provider
 *
 * Waits for user input from the TUI.
 * Emits events so TUI knows to show prompt box.
 */

import { debug } from '../../../shared/logging/logger.js';
import type {
  InputProvider,
  InputContext,
  InputResult,
  InputEventEmitter,
} from '../types.js';

/**
 * User input provider options
 */
export interface UserInputProviderOptions {
  emitter: InputEventEmitter;
}

/**
 * User input provider
 *
 * Waits for user to submit input via TUI.
 * Listens for 'workflow:input' process events.
 */
export class UserInputProvider implements InputProvider {
  readonly id = 'user';

  private emitter: InputEventEmitter;
  private resolver: ((result: InputResult) => void) | null = null;
  private currentContext: InputContext | null = null;
  private inputListener: ((data?: { prompt?: string; skip?: boolean }) => void) | null = null;
  private modeChangeListener: ((data: { autonomousMode: boolean }) => void) | null = null;

  constructor(options: UserInputProviderOptions) {
    this.emitter = options.emitter;
  }

  async getInput(context: InputContext): Promise<InputResult> {
    this.currentContext = context;

    debug('[UserInput] Waiting for user input, step %d', context.stepIndex);

    // Emit waiting event for TUI
    this.emitter.emitWaiting({
      stepIndex: context.stepIndex,
      promptQueue: context.promptQueue,
      promptQueueIndex: context.promptQueueIndex,
      monitoringId: context.stepOutput.monitoringId,
    });

    // Set up listener for process events
    this.inputListener = (data) => {
      this.handleInput(data);
    };
    process.on('workflow:input', this.inputListener);

    // Set up listener for mode change (switch to autonomous)
    this.modeChangeListener = (data) => {
      if (data.autonomousMode && this.resolver) {
        debug('[UserInput] Mode change to autonomous, signaling switch');
        this.emitter.emitCanceled();
        this.resolver({ type: 'input', value: '__SWITCH_TO_AUTO__' });
        this.resolver = null;
        this.currentContext = null;
      }
    };
    process.on('workflow:mode-change', this.modeChangeListener);

    try {
      return await new Promise<InputResult>((resolve) => {
        this.resolver = resolve;
      });
    } finally {
      // Clean up listeners
      if (this.inputListener) {
        process.removeListener('workflow:input', this.inputListener);
        this.inputListener = null;
      }
      if (this.modeChangeListener) {
        process.removeListener('workflow:mode-change', this.modeChangeListener);
        this.modeChangeListener = null;
      }
    }
  }

  private handleInput(data?: { prompt?: string; skip?: boolean }): void {
    if (!this.resolver || !this.currentContext) {
      debug('[UserInput] Received input but no resolver active');
      return;
    }

    debug('[UserInput] Received input: prompt=%s, skip=%s', data?.prompt, data?.skip);
    debug('[UserInput] Context: promptQueue=%d items, queueIndex=%d',
      this.currentContext.promptQueue.length, this.currentContext.promptQueueIndex);

    // Handle skip
    if (data?.skip) {
      this.emitter.emitReceived({
        input: '',
        source: 'user',
        promptQueue: this.currentContext.promptQueue,
        promptQueueIndex: this.currentContext.promptQueueIndex,
      });
      this.resolver({ type: 'skip' });
      this.resolver = null;
      this.currentContext = null;
      return;
    }

    // Handle input (or empty = use queue)
    let input = data?.prompt;

    // If no input provided, check queue
    if (!input && this.currentContext.promptQueue.length > 0) {
      const queueIndex = this.currentContext.promptQueueIndex;
      debug('[UserInput] Checking queue: queueIndex=%d, queueLength=%d', queueIndex, this.currentContext.promptQueue.length);
      if (queueIndex < this.currentContext.promptQueue.length) {
        const queuedPrompt = this.currentContext.promptQueue[queueIndex];
        input = queuedPrompt.content;
        debug('[UserInput] Using queued prompt [%d]: %s - "%s"', queueIndex, queuedPrompt.label, input?.slice(0, 50));
      } else {
        debug('[UserInput] Queue exhausted (index %d >= length %d)', queueIndex, this.currentContext.promptQueue.length);
      }
    }

    // If still no input, treat as continue to next step
    if (!input) {
      debug('[UserInput] Empty input, continuing to next step');
      this.emitter.emitReceived({
        input: '',
        source: 'user',
        promptQueue: this.currentContext.promptQueue,
        promptQueueIndex: this.currentContext.promptQueueIndex,
      });
      this.resolver({ type: 'input', value: '' });
      this.resolver = null;
      this.currentContext = null;
      return;
    }

    // Normal input
    this.emitter.emitReceived({
      input,
      source: 'user',
      promptQueue: this.currentContext.promptQueue,
      promptQueueIndex: this.currentContext.promptQueueIndex,
    });
    this.resolver({
      type: 'input',
      value: input,
      resumeMonitoringId: this.currentContext.stepOutput.monitoringId,
    });
    this.resolver = null;
    this.currentContext = null;
  }

  activate(): void {
    debug('[UserInput] Activated');
  }

  deactivate(): void {
    debug('[UserInput] Deactivated');
    this.abort();
  }

  abort(): void {
    if (this.inputListener) {
      process.removeListener('workflow:input', this.inputListener);
      this.inputListener = null;
    }

    if (this.modeChangeListener) {
      process.removeListener('workflow:mode-change', this.modeChangeListener);
      this.modeChangeListener = null;
    }

    if (this.resolver) {
      debug('[UserInput] Aborting pending input wait');
      this.emitter.emitCanceled();
      // Don't resolve - let the caller handle abort
      this.resolver = null;
      this.currentContext = null;
    }
  }

  /**
   * Externally provide input (for testing or programmatic use)
   */
  submit(prompt: string): void {
    this.handleInput({ prompt });
  }

  /**
   * Externally trigger skip
   */
  skip(): void {
    this.handleInput({ skip: true });
  }
}
