/**
 * Autopilot Input Provider
 *
 * Gets input from an autopilot agent (autonomous mode).
 * The autopilot agent sees step output and decides what to do.
 */

import { debug } from '../../shared/logging/logger.js';
import { executeAgent } from '../../agents/runner/runner.js';
import { AgentLoggerService, AgentMonitorService } from '../../agents/monitoring/index.js';
import {
  parseAutopilotAction,
  extractInputText,
  saveAutopilotConfig,
  type AutopilotAction,
} from '../../shared/workflows/autopilot.js';
import { stripColorMarkers } from '../../shared/formatters/logFileFormatter.js';
import {
  formatAutopilotHeader,
  formatAutopilotFooter,
} from '../../shared/formatters/outputMarkers.js';
import type { AutopilotConfig } from '../../shared/workflows/template.js';
import type {
  InputProvider,
  InputContext,
  InputResult,
  InputEventEmitter,
} from './types.js';

/**
 * Autopilot input provider options
 */
export interface AutopilotInputProviderOptions {
  emitter: InputEventEmitter;
  getAutopilotConfig: () => Promise<AutopilotConfig | null>;
  cwd: string;
  cmRoot: string;
}

/**
 * Autopilot input provider
 *
 * Sends step output to autopilot agent and parses response.
 * Autopilot can respond with:
 * - ACTION: NEXT - advance to next step (mark current complete)
 * - ACTION: CONTINUE - resume agent with empty input (let it keep working)
 * - ACTION: SKIP - skip remaining prompts, advance to next step
 * - ACTION: STOP - stop workflow
 * - ACTION: LOOP - re-run current step from beginning
 * - ACTION: WAIT - switch to manual mode, wait for user input
 * - (text) - send as input to resume current step
 */
export class AutopilotInputProvider implements InputProvider {
  readonly id = 'autopilot';

  private emitter: InputEventEmitter;
  private getAutopilotConfig: () => Promise<AutopilotConfig | null>;
  private cwd: string;
  private cmRoot: string;
  private aborted = false;
  private abortController: AbortController | null = null;
  private modeChangeListener: ((data: { autonomousMode: boolean }) => void) | null = null;

  constructor(options: AutopilotInputProviderOptions) {
    this.emitter = options.emitter;
    this.getAutopilotConfig = options.getAutopilotConfig;
    this.cwd = options.cwd;
    this.cmRoot = options.cmRoot;
  }

  async getInput(context: InputContext): Promise<InputResult> {
    this.aborted = false;

    const config = await this.getAutopilotConfig();
    if (!config) {
      debug('[Autopilot] No autopilot config, falling back to skip');
      return { type: 'skip' };
    }

    debug('[Autopilot] Getting input from autopilot agent: %s', config.agentId);

    const loggerService = AgentLoggerService.getInstance();

    // Set up abort controller for this execution
    this.abortController = new AbortController();

    // Listen for mode change (user switches to manual)
    let switchToManual = false;
    this.modeChangeListener = (data) => {
      if (!data.autonomousMode) {
        debug('[Autopilot] Mode change to manual requested, aborting execution');
        switchToManual = true;
        // Abort the current execution immediately
        this.abortController?.abort();
      }
    };
    process.on('workflow:mode-change', this.modeChangeListener);

    try {
      // Build prompt for autopilot with cleaned step output
      const cleanOutput = stripColorMarkers(context.stepOutput.output || '').trim();
      const prompt = cleanOutput
        ? `REMINDER: Always follow your system prompt instructions.

CURRENT STEP OUTPUT:
---
${cleanOutput}
---

Review the output above and respond appropriately.
Available actions: ACTION: NEXT (advance to next step), ACTION: CONTINUE (let agent keep working), ACTION: SKIP, ACTION: STOP, ACTION: LOOP, ACTION: WAIT`
        : 'REMINDER: Always follow the rules and instructions given in your first message - that is your system prompt. Now continue.';

      // Write autopilot header
      if (context.stepOutput.monitoringId !== undefined) {
        loggerService.write(context.stepOutput.monitoringId, '\n' + formatAutopilotHeader('Autopilot') + '\n');
      }

      // Execute autopilot agent (resume existing session)
      // IMPORTANT: Use step's monitoring ID to avoid resetting the step's timer
      const result = await executeAgent(config.agentId, prompt, {
        workingDir: this.cwd,
        resumeSessionId: config.sessionId,
        resumeMonitoringId: context.stepOutput.monitoringId,
        resumePrompt: prompt,
        abortSignal: this.abortController.signal,
        logger: (chunk) => {
          // Log autopilot output to step's log (preserve original formatting)
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

      // Write autopilot footer
      if (context.stepOutput.monitoringId !== undefined) {
        loggerService.write(context.stepOutput.monitoringId, '\n' + formatAutopilotFooter() + '\n');
      }

      // Update sessionId if a new one was created (important for session persistence)
      if (result.agentId !== undefined) {
        const monitor = AgentMonitorService.getInstance();
        const agentInfo = monitor.getAgent(result.agentId);
        if (agentInfo?.sessionId && agentInfo.sessionId !== config.sessionId) {
          debug('[Autopilot] Session ID changed: %s -> %s', config.sessionId, agentInfo.sessionId);
          // Update the config with new sessionId
          await saveAutopilotConfig(this.cmRoot, {
            agentId: config.agentId,
            sessionId: agentInfo.sessionId,
            monitoringId: result.agentId,
          });
        }
      }

      if (this.aborted) {
        debug('[Autopilot] Aborted during execution');
        return { type: 'stop' };
      }

      // Check if user switched to manual mode (shouldn't reach here if aborted, but just in case)
      if (switchToManual) {
        debug('[Autopilot] Switching to manual mode');
        this.emitter.emitCanceled();
        // Return special result that tells runner to switch providers
        return { type: 'input', value: '__SWITCH_TO_MANUAL__' };
      }

      const response = result.output;
      debug('[Autopilot] Response: %s...', response.slice(0, 100));

      // Parse for action commands
      const action = parseAutopilotAction(response);

      if (action) {
        debug('[Autopilot] Action detected: %s', action);
        return this.handleAction(action, context);
      }

      // No action - use response as input
      const cleanedResponse = extractInputText(response);
      debug('[Autopilot] Sending as input: %s...', cleanedResponse.slice(0, 50));

      this.emitter.emitReceived({ input: cleanedResponse, source: 'autopilot' });
      return {
        type: 'input',
        value: cleanedResponse,
        resumeMonitoringId: context.stepOutput.monitoringId,
        source: 'autopilot',
      };
    } catch (error) {
      // Handle abort (mode switch to manual)
      if (error instanceof Error && error.name === 'AbortError') {
        if (switchToManual) {
          debug('[Autopilot] Aborted due to mode switch to manual');
          this.emitter.emitCanceled();
          return { type: 'input', value: '__SWITCH_TO_MANUAL__' };
        }
        // General abort (stop workflow)
        debug('[Autopilot] Aborted');
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

  /**
   * Handle autopilot action commands
   */
  private handleAction(action: AutopilotAction, context: InputContext): InputResult {
    switch (action) {
      case 'NEXT': {
        // Advance to next step (mark current complete)
        // Use next queued prompt if available, otherwise empty to advance
        const hasQueuedPrompt = context.promptQueue.length > 0 &&
          context.promptQueueIndex < context.promptQueue.length;
        const nextPrompt = hasQueuedPrompt
          ? context.promptQueue[context.promptQueueIndex].content
          : '';
        debug('[Autopilot] ACTION: NEXT with prompt: %s', nextPrompt ? nextPrompt.slice(0, 50) + '...' : '(empty - advancing to next step)');
        this.emitter.emitReceived({ input: nextPrompt, source: 'autopilot' });
        return {
          type: 'input',
          value: nextPrompt,
          resumeMonitoringId: context.stepOutput.monitoringId,
          source: 'autopilot',
        };
      }

      case 'CONTINUE': {
        // Resume agent with empty input (let it keep working on current step)
        debug('[Autopilot] ACTION: CONTINUE - resuming agent without input');
        this.emitter.emitReceived({ input: '', source: 'autopilot' });
        return {
          type: 'input',
          value: '',
          resumeMonitoringId: context.stepOutput.monitoringId,
          source: 'autopilot',
        };
      }

      case 'SKIP':
        // Skip remaining prompts, advance to next step
        debug('[Autopilot] ACTION: SKIP - skipping remaining prompts');
        this.emitter.emitReceived({ input: '', source: 'autopilot' });
        return { type: 'skip' };

      case 'STOP':
        // Stop the workflow
        debug('[Autopilot] ACTION: STOP - stopping workflow');
        this.emitter.emitReceived({ input: '', source: 'autopilot' });
        return { type: 'stop' };

      case 'LOOP':
        // Re-run current step from beginning
        debug('[Autopilot] ACTION: LOOP - restarting current step');
        this.emitter.emitReceived({ input: '', source: 'autopilot' });
        return { type: 'loop' };

      case 'WAIT':
        // Switch to manual mode, wait for user input
        debug('[Autopilot] ACTION: WAIT - switching to manual mode');
        this.emitter.emitCanceled();
        return { type: 'input', value: '__SWITCH_TO_MANUAL__' };

      default:
        // Exhaustive check
        const _exhaustive: never = action;
        debug('[Autopilot] Unknown action: %s', _exhaustive);
        return { type: 'skip' };
    }
  }

  activate(): void {
    debug('[Autopilot] Activated');
    this.aborted = false;
  }

  deactivate(): void {
    debug('[Autopilot] Deactivated');
    this.abort();
  }

  abort(): void {
    debug('[Autopilot] Aborting');
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

// Legacy alias for backwards compatibility
/** @deprecated Use AutopilotInputProvider instead */
export const ControllerInputProvider = AutopilotInputProvider;
/** @deprecated Use AutopilotInputProviderOptions instead */
export type ControllerInputProviderOptions = AutopilotInputProviderOptions;
