import { formatUserInput } from '../../shared/formatters/outputMarkers.js';
import { debug } from '../../shared/logging/logger.js';
import {
  markStepCompleted,
  updateStepSession,
  markChainCompleted,
} from '../../shared/workflows/index.js';
import { AgentLoggerService, AgentMonitorService } from '../../agents/monitoring/index.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { ModuleStep } from '../templates/types.js';
import { executeStep, type ChainedPrompt } from './step.js';

export interface InputState {
  active: boolean;
  requested: boolean; // True when user pressed P to abort current step
  stepIndex: number | null;
  monitoringId: number | undefined;
  // Queue of prompts (from chained prompts config)
  queuedPrompts: ChainedPrompt[];
  currentIndex: number;
  // User input
  pendingPrompt: string | undefined;
  pendingSkip: boolean;
  resolver: (() => void) | null;
}

export function createInputState(): InputState {
  return {
    active: false,
    requested: false,
    stepIndex: null,
    monitoringId: undefined,
    queuedPrompts: [],
    currentIndex: 0,
    pendingPrompt: undefined,
    pendingSkip: false,
    resolver: null,
  };
}

interface StepOutput {
  output: string;
  monitoringId?: number;
  chainedPrompts?: ChainedPrompt[];
}

interface HandleInputLoopOptions {
  inputState: InputState;
  stepOutput: StepOutput;
  step: ModuleStep;
  cwd: string;
  cmRoot: string;
  index: number;
  emitter: WorkflowEventEmitter;
  uniqueAgentId: string;
  abortController: AbortController;
  isResumingFromChain: boolean;
  chainResumeInfo: { chainIndex: number; monitoringId: number } | null;
  isResumingFromSavedSessionWithChains: boolean;
  stepResumePrompt: string | undefined;
  stepResumeMonitoringId: number | undefined;
}

/**
 * Handle chained prompts and user input loop
 */
export async function handleInputLoop(options: HandleInputLoopOptions): Promise<void> {
  const {
    inputState,
    stepOutput,
    step,
    cwd,
    cmRoot,
    index,
    emitter,
    uniqueAgentId,
    abortController,
    isResumingFromChain,
    chainResumeInfo,
    isResumingFromSavedSessionWithChains,
    stepResumePrompt,
    stepResumeMonitoringId,
  } = options;

  const hasChainedPrompts = stepOutput.chainedPrompts && stepOutput.chainedPrompts.length > 0;
  const shouldEnterInputLoop = (stepResumePrompt && stepResumeMonitoringId) || hasChainedPrompts || isResumingFromChain || isResumingFromSavedSessionWithChains;
  debug(`[DEBUG workflow] hasChainedPrompts=${hasChainedPrompts}, shouldEnterInputLoop=${shouldEnterInputLoop}`);

  if (!shouldEnterInputLoop) {
    return;
  }

  // Initialize input state
  inputState.active = true;
  inputState.monitoringId = isResumingFromChain && chainResumeInfo
    ? chainResumeInfo.monitoringId
    : stepOutput.monitoringId;
  inputState.queuedPrompts = hasChainedPrompts ? stepOutput.chainedPrompts! : [];
  // Resume from saved chain index if available
  inputState.currentIndex = isResumingFromChain && chainResumeInfo
    ? chainResumeInfo.chainIndex
    : 0;

  // Check if all chains are already done (resume edge case)
  const allChainsAlreadyDone = isResumingFromChain && inputState.currentIndex >= inputState.queuedPrompts.length;

  if (allChainsAlreadyDone) {
    // All chains already completed - mark step complete and continue to next step
    emitter.logMessage(uniqueAgentId, `All chained prompts already completed. Continuing to next agent.`);
    await markStepCompleted(cmRoot, index);
    inputState.active = false;
    inputState.queuedPrompts = [];
    inputState.currentIndex = 0;
    inputState.monitoringId = undefined;
    return;
  }

  if (isResumingFromChain && chainResumeInfo) {
    emitter.logMessage(uniqueAgentId, `Resuming from chain ${chainResumeInfo.chainIndex + 1}/${inputState.queuedPrompts.length}...`);
  }

  // Keep agent status as "running" while in input loop
  emitter.updateAgentStatus(uniqueAgentId, 'running');

  // Emit input state to TUI
  emitter.setInputState({
    active: true,
    queuedPrompts: inputState.queuedPrompts.map(p => ({ name: p.name, label: p.label, content: p.content })),
    currentIndex: inputState.currentIndex,
    monitoringId: inputState.monitoringId,
  });

  let currentStepOutput = stepOutput;

  while (inputState.active) {
    // Wait for user input via workflow:input event
    await new Promise<void>((resolve) => {
      inputState.resolver = resolve;
    });

    // Handle skip
    if (inputState.pendingSkip) {
      emitter.logMessage(uniqueAgentId, `Skipping remaining prompts.`);
      inputState.active = false;
      inputState.pendingSkip = false;
      break;
    }

    // Determine prompt to use
    let promptToUse = inputState.pendingPrompt;

    if (!promptToUse && inputState.queuedPrompts.length > 0) {
      // Empty input = use next queued prompt
      if (inputState.currentIndex < inputState.queuedPrompts.length) {
        const nextPrompt = inputState.queuedPrompts[inputState.currentIndex];
        promptToUse = nextPrompt.content;
        emitter.logMessage(uniqueAgentId, `Feeding chained prompt: "${nextPrompt.label}"`);
        inputState.currentIndex += 1;
      } else {
        // No more queued prompts - continue to next agent
        emitter.logMessage(uniqueAgentId, `All chained prompts completed. Continuing to next agent.`);
        inputState.active = false;
        break;
      }
    }

    if (!promptToUse) {
      // Empty input with no queue = continue to next agent
      emitter.setWorkflowStatus('running');
      inputState.active = false;
      break;
    }

    // User sent a prompt - log it and resume
    if (inputState.pendingPrompt) {
      // Only log user input for custom prompts (not queued ones)
      const userInputLog = formatUserInput(promptToUse);
      emitter.logMessage(uniqueAgentId, userInputLog);

      // Write to agent log file
      if (inputState.monitoringId !== undefined) {
        const loggerService = AgentLoggerService.getInstance();
        loggerService.write(inputState.monitoringId, `\n${userInputLog}\n`);
      }
    }

    // Clear pending prompt
    inputState.pendingPrompt = undefined;

    // Set status back to running
    emitter.updateAgentStatus(uniqueAgentId, 'running');
    emitter.setWorkflowStatus('running');

    // Resume with the prompt
    currentStepOutput = await executeStep(step, cwd, {
      logger: () => {},
      stderrLogger: () => {},
      emitter,
      abortSignal: abortController.signal,
      uniqueAgentId,
      resumeMonitoringId: inputState.monitoringId,
      resumePrompt: promptToUse,
    });

    // Update monitoring ID for next iteration
    inputState.monitoringId = currentStepOutput.monitoringId;

    // Update session data if changed
    if (inputState.monitoringId !== undefined) {
      const monitor = AgentMonitorService.getInstance();
      const agent = monitor.getAgent(inputState.monitoringId);
      const sessionId = agent?.sessionId ?? '';
      await updateStepSession(cmRoot, index, sessionId, inputState.monitoringId);
    }

    // Mark the chain we just completed (currentIndex was incremented before execution)
    const completedChainIndex = inputState.currentIndex - 1;
    if (completedChainIndex >= 0) {
      await markChainCompleted(cmRoot, index, completedChainIndex);
    }

    // Update UI with new state
    emitter.setInputState({
      active: true,
      queuedPrompts: inputState.queuedPrompts.map(p => ({ name: p.name, label: p.label, content: p.content })),
      currentIndex: inputState.currentIndex,
      monitoringId: inputState.monitoringId,
    });
  }

  // Clear input state
  inputState.active = false;
  inputState.queuedPrompts = [];
  inputState.currentIndex = 0;
  inputState.monitoringId = undefined;
  inputState.pendingPrompt = undefined;
  inputState.pendingSkip = false;
  emitter.setInputState(null);

  // Mark step as completed after all chained prompts are done
  // This ensures steps with chained prompts are marked complete even without executeOnce
  if (hasChainedPrompts) {
    await markStepCompleted(cmRoot, index);
  }
}
