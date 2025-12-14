/**
 * Controller Input Provider
 *
 * Gets input from a controller agent (autonomous mode).
 * The controller agent sees step output and decides what to do.
 */

import { debug } from '../../shared/logging/logger.js';
import { executeAgent } from '../../agents/runner/runner.js';
import { AgentLoggerService } from '../../agents/monitoring/index.js';
import {
  parseControllerAction,
  extractInputText,
} from '../../shared/workflows/controller.js';
import type { ControllerConfig } from '../../shared/workflows/template.js';
import type {
  InputProvider,
  InputContext,
  InputResult,
  InputEventEmitter,
} from './types.js';

/**
 * Controller input provider options
 */
export interface ControllerInputProviderOptions {
  emitter: InputEventEmitter;
  getControllerConfig: () => Promise<ControllerConfig | null>;
  cwd: string;
}

/**
 * Controller input provider
 *
 * Sends step output to controller agent and parses response.
 * Controller can respond with:
 * - ACTION: NEXT - continue to next step
 * - ACTION: SKIP - skip remaining prompts
 * - ACTION: STOP - stop workflow
 * - (text) - send as input to resume current step
 */
export class ControllerInputProvider implements InputProvider {
  readonly id = 'controller';

  private emitter: InputEventEmitter;
  private getControllerConfig: () => Promise<ControllerConfig | null>;
  private cwd: string;
  private aborted = false;
  private abortController: AbortController | null = null;
  private modeChangeListener: ((data: { autonomousMode: boolean }) => void) | null = null;

  constructor(options: ControllerInputProviderOptions) {
    this.emitter = options.emitter;
    this.getControllerConfig = options.getControllerConfig;
    this.cwd = options.cwd;
  }

  async getInput(context: InputContext): Promise<InputResult> {
    this.aborted = false;

    const config = await this.getControllerConfig();
    if (!config) {
      debug('[Controller] No controller config, falling back to skip');
      return { type: 'skip' };
    }

    debug('[Controller] Getting input from controller agent: %s', config.agentId);

    const loggerService = AgentLoggerService.getInstance();

    // Set up abort controller for this execution
    this.abortController = new AbortController();

    // Listen for mode change (user switches to manual)
    let switchToManual = false;
    this.modeChangeListener = (data) => {
      if (!data.autonomousMode) {
        debug('[Controller] Mode change to manual requested, aborting execution');
        switchToManual = true;
        // Abort the current execution immediately
        this.abortController?.abort();
      }
    };
    process.on('workflow:mode-change', this.modeChangeListener);

    try {
      // Build prompt for controller
      const prompt = context.stepOutput.output || 'Continue from where you left off.';

      // Execute controller agent (resume existing session)
      const result = await executeAgent(config.agentId, prompt, {
        workingDir: this.cwd,
        resumeSessionId: config.sessionId,
        resumePrompt: prompt,
        abortSignal: this.abortController.signal,
        logger: (chunk) => {
          // Log controller output to step's log
          if (context.stepOutput.monitoringId !== undefined) {
            loggerService.write(context.stepOutput.monitoringId, chunk);
          }
        },
        stderrLogger: (chunk) => {
          if (context.stepOutput.monitoringId !== undefined) {
            loggerService.write(context.stepOutput.monitoringId, `[STDERR] ${chunk}`);
          }
        },
      });

      if (this.aborted) {
        debug('[Controller] Aborted during execution');
        return { type: 'stop' };
      }

      // Check if user switched to manual mode (shouldn't reach here if aborted, but just in case)
      if (switchToManual) {
        debug('[Controller] Switching to manual mode');
        this.emitter.emitCanceled();
        // Return special result that tells runner to switch providers
        return { type: 'input', value: '__SWITCH_TO_MANUAL__' };
      }

      const response = result.output;
      debug('[Controller] Response: %s...', response.slice(0, 100));

      // Parse for action commands
      const action = parseControllerAction(response);

      if (action) {
        debug('[Controller] Action detected: %s', action);

        switch (action) {
          case 'NEXT':
            this.emitter.emitReceived({ input: '', source: 'controller' });
            return { type: 'input', value: '' };
          case 'SKIP':
            this.emitter.emitReceived({ input: '', source: 'controller' });
            return { type: 'skip' };
          case 'STOP':
            this.emitter.emitReceived({ input: '', source: 'controller' });
            return { type: 'stop' };
        }
      }

      // No action - use response as input
      const cleanedResponse = extractInputText(response);
      debug('[Controller] Sending as input: %s...', cleanedResponse.slice(0, 50));

      this.emitter.emitReceived({ input: cleanedResponse, source: 'controller' });
      return {
        type: 'input',
        value: cleanedResponse,
        resumeMonitoringId: context.stepOutput.monitoringId,
        source: 'controller',
      };
    } catch (error) {
      // Handle abort (mode switch to manual)
      if (error instanceof Error && error.name === 'AbortError') {
        if (switchToManual) {
          debug('[Controller] Aborted due to mode switch to manual');
          this.emitter.emitCanceled();
          return { type: 'input', value: '__SWITCH_TO_MANUAL__' };
        }
        // General abort (stop workflow)
        debug('[Controller] Aborted');
        return { type: 'stop' };
      }
      throw error;
    } finally {
      // Clean up
      this.abortController = null;
      if (this.modeChangeListener) {
        process.removeListener('workflow:mode-change', this.modeChangeListener);
        this.modeChangeListener = null;
      }
    }
  }

  activate(): void {
    debug('[Controller] Activated');
    this.aborted = false;
  }

  deactivate(): void {
    debug('[Controller] Deactivated');
    this.abort();
  }

  abort(): void {
    debug('[Controller] Aborting');
    this.aborted = true;

    // Abort any running execution
    this.abortController?.abort();
    this.abortController = null;

    if (this.modeChangeListener) {
      process.removeListener('workflow:mode-change', this.modeChangeListener);
      this.modeChangeListener = null;
    }

    this.emitter.emitCanceled();
  }
}
