/**
 * Controller Input Provider
 *
 * Gets input from a controller agent (autonomous mode).
 * The controller agent sees step output and decides what to do.
 */

import { debug } from '../../../shared/logging/logger.js';
import { executeWithActions } from '../../../agents/execution/index.js';
import { AgentLoggerService, AgentMonitorService } from '../../../agents/monitoring/index.js';
import { loadAgentConfig } from '../../../agents/runner/config.js';
import { saveControllerConfig } from '../../controller/config.js';
import {
  formatControllerHeader,
  formatControllerFooter,
  stripAllMarkers,
} from '../../../shared/formatters/outputMarkers.js';
import { controllerTemplateReview } from '../../../shared/prompts/index.js';
import type { ControllerConfig } from '../../../shared/workflows/template.js';
import type { WorkflowEventEmitter } from '../../events/index.js';
import type {
  InputProvider,
  InputContext,
  InputResult,
  InputEventEmitter,
} from '../types.js';

/**
 * Controller input provider options
 */
export interface ControllerInputProviderOptions {
  emitter: InputEventEmitter;
  getControllerConfig: () => Promise<ControllerConfig | null>;
  /** Fallback provider when no controller configured (for interactive steps in autoMode) */
  getUserInput: () => InputProvider;
  cwd: string;
  cmRoot: string;
  /** Workflow emitter for telemetry updates */
  workflowEmitter?: WorkflowEventEmitter;
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
  private getUserInput: () => InputProvider;
  private cwd: string;
  private cmRoot: string;
  private workflowEmitter?: WorkflowEventEmitter;
  private aborted = false;
  private abortController: AbortController | null = null;
  private modeChangeListener: ((data: { autonomousMode: string }) => void) | null = null;

  constructor(options: ControllerInputProviderOptions) {
    this.emitter = options.emitter;
    this.getControllerConfig = options.getControllerConfig;
    this.getUserInput = options.getUserInput;
    this.cwd = options.cwd;
    this.cmRoot = options.cmRoot;
    this.workflowEmitter = options.workflowEmitter;
  }

  async getInput(context: InputContext): Promise<InputResult> {
    this.aborted = false;

    // Emit queue state immediately so UI shows step info while controller runs
    // Use emitReceived (active=false) to show info without enabling input box
    if (context.promptQueue.length > 0) {
      this.emitter.emitReceived({
        input: '',
        source: 'controller',
        promptQueue: context.promptQueue,
        promptQueueIndex: context.promptQueueIndex,
      });
    }

    const config = await this.getControllerConfig();
    if (!config) {
      debug('[Controller] No controller config, delegating to user input');
      return this.getUserInput().getInput(context);
    }

    debug('[Controller] Getting input from controller agent: %s', config.agentId);

    const loggerService = AgentLoggerService.getInstance();

    // Set up abort controller for this execution
    this.abortController = new AbortController();

    // Listen for mode change (user switches to manual)
    let switchToManual = false;
    this.modeChangeListener = (data) => {
      // Check for string 'false' or 'never' (manual mode)
      if (data.autonomousMode === 'false' || data.autonomousMode === 'never') {
        debug('[Controller] Mode change to manual requested, aborting execution');
        switchToManual = true;
        // Abort the current execution immediately
        this.abortController?.abort();
      }
    };
    process.on('workflow:mode-change', this.modeChangeListener);

    try {
      // Build prompt for controller with cleaned step output
      // Add AGENT prefix with step agent name so controller knows the source
      const stepAgentName = context.step.agentName || context.step.agentId;
      const cleanOutput = stripAllMarkers(context.stepOutput.output || '').trim();
      const prompt = controllerTemplateReview(stepAgentName, cleanOutput);

      // Write controller header with dynamic agent name
      const agentConfig = await loadAgentConfig(config.agentId, this.cmRoot);
      const controllerName = agentConfig.name || config.agentId;

      // Get engine/model from MonitorService (single source of truth)
      const monitor = AgentMonitorService.getInstance();
      const controllerAgent = monitor.getAgent(config.monitoringId);
      const resolvedEngine = controllerAgent?.engine ?? 'unknown';
      const resolvedModel = controllerAgent?.modelName ?? 'unknown';

      // Emit controller info to UI
      if (this.workflowEmitter) {
        this.workflowEmitter.setControllerInfo(
          config.agentId,
          controllerName,
          resolvedEngine,
          resolvedModel
        );
      }

      if (context.stepOutput.monitoringId !== undefined) {
        loggerService.write(context.stepOutput.monitoringId, '\n' + formatControllerHeader(controllerName) + '\n');
      }

      // Resume controller session - reuse existing monitoring entry to avoid duplicate agent/log registration
      const result = await executeWithActions(config.agentId, prompt, {
        workingDir: this.cwd,
        engine: resolvedEngine !== 'unknown' ? resolvedEngine : undefined,
        model: resolvedModel !== 'unknown' ? resolvedModel : undefined,
        resumeSessionId: config.sessionId,
        resumeMonitoringId: config.monitoringId,
        resumePrompt: prompt,
        abortSignal: this.abortController.signal,
        logger: (chunk) => {
          // Log controller output to step's log (preserve original formatting)
          if (context.stepOutput.monitoringId !== undefined) {
            loggerService.write(context.stepOutput.monitoringId, chunk);
          }
        },
        stderrLogger: (chunk) => {
          if (context.stepOutput.monitoringId !== undefined) {
            loggerService.write(context.stepOutput.monitoringId, `[STDERR] ${chunk}`);
          }
        },
        // Add telemetry support - route to controller's own telemetry (not step agent's)
        telemetry: this.workflowEmitter
          ? { uniqueAgentId: '', emitter: this.workflowEmitter, isController: true }
          : undefined,
      });

      // Write controller footer
      if (context.stepOutput.monitoringId !== undefined) {
        loggerService.write(context.stepOutput.monitoringId, '\n' + formatControllerFooter() + '\n');
      }

      // Update sessionId if a new one was created (important for session persistence)
      if (result.agentId !== undefined) {
        const monitor = AgentMonitorService.getInstance();
        const agentInfo = monitor.getAgent(result.agentId);
        if (agentInfo?.sessionId && agentInfo.sessionId !== config.sessionId) {
          debug('[Controller] Session ID changed: %s -> %s', config.sessionId, agentInfo.sessionId);
          // Update the config with new sessionId
          await saveControllerConfig(this.cmRoot, {
            agentId: config.agentId,
            sessionId: agentInfo.sessionId,
            monitoringId: result.agentId,
          });
        }
      }

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

      debug('[Controller] Response: %s...', result.output.slice(0, 100));

      // Action already parsed by executeWithActions
      if (result.action) {
        debug('[Controller] Action detected: %s', result.action);
        debug('[Controller] Queue state at action: queueLen=%d, queueIndex=%d, stepIndex=%d',
          context.promptQueue.length, context.promptQueueIndex, context.stepIndex);

        switch (result.action) {
          case 'NEXT': {
            // Use next queued prompt content to advance
            const hasQueuedPrompt = context.promptQueue.length > 0 &&
              context.promptQueueIndex < context.promptQueue.length;
            const nextPrompt = hasQueuedPrompt
              ? context.promptQueue[context.promptQueueIndex].content
              : '';
            debug('[Controller] ACTION: NEXT hasQueuedPrompt=%s, queueIndex=%d/%d',
              hasQueuedPrompt, context.promptQueueIndex, context.promptQueue.length);
            debug('[Controller] ACTION: NEXT returning prompt: %s', nextPrompt ? nextPrompt.slice(0, 80) + '...' : '(empty - will advance step)');
            this.emitter.emitReceived({
              input: nextPrompt,
              source: 'controller',
              promptQueue: context.promptQueue,
              promptQueueIndex: context.promptQueueIndex,
            });
            return {
              type: 'input',
              value: nextPrompt,
              resumeMonitoringId: context.stepOutput.monitoringId,
              source: 'controller',
            };
          }
          case 'SKIP':
            this.emitter.emitReceived({
              input: '',
              source: 'controller',
              promptQueue: context.promptQueue,
              promptQueueIndex: context.promptQueueIndex,
            });
            return { type: 'skip' };
          case 'STOP':
            this.emitter.emitReceived({
              input: '',
              source: 'controller',
              promptQueue: context.promptQueue,
              promptQueueIndex: context.promptQueueIndex,
            });
            return { type: 'stop' };
        }
      }

      // No action - clean controller output and use as input to step
      const cleanedResponse = stripAllMarkers(result.output);
      debug('[Controller] Sending as input: %s...', cleanedResponse.slice(0, 50));

      this.emitter.emitReceived({
        input: cleanedResponse,
        source: 'controller',
        promptQueue: context.promptQueue,
        promptQueueIndex: context.promptQueueIndex,
      });
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
