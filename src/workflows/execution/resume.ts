import { debug } from '../../shared/logging/logger.js';
import { initStepSession } from '../../shared/workflows/index.js';
import { AgentMonitorService } from '../../agents/monitoring/index.js';
import { loadAgentConfig } from '../../agents/runner/index.js';
import { loadChainedPrompts } from '../../agents/runner/chained.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { ModuleStep } from '../templates/types.js';
import { executeStep, type ChainedPrompt } from './step.js';
import { shouldExecuteFallback, executeFallbackStep } from './fallback.js';

interface StepOutput {
  output: string;
  monitoringId?: number;
  chainedPrompts?: ChainedPrompt[];
}

interface ChainResumeInfo {
  stepIndex: number;
  chainIndex: number;
  monitoringId: number;
}

interface StepDataForResume {
  sessionId?: string;
  monitoringId?: number;
}

interface ExecWithResumeOptions {
  step: ModuleStep;
  cwd: string;
  cmRoot: string;
  index: number;
  emitter: WorkflowEventEmitter;
  uniqueAgentId: string;
  abortController: AbortController;
  notCompletedSteps: number[];
  isResumingFromChain: boolean;
  chainResumeInfo: ChainResumeInfo | null;
  shouldResumeFromSavedSession: boolean;
  stepDataForResume: StepDataForResume | null;
  shouldResumeFromPause: boolean;
  stepResumeMonitoringId: number | undefined;
  stepResumePrompt: string | undefined;
  selectedConditions: string[];
}

interface ExecWithResumeResult {
  stepOutput: StepOutput;
  isResumingFromSavedSessionWithChains: boolean;
}

/**
 * Execute step with resume logic - handles fallback, chain resume, saved session, and fresh execution
 */
export async function execWithResume(options: ExecWithResumeOptions): Promise<ExecWithResumeResult> {
  const {
    step,
    cwd,
    cmRoot,
    index,
    emitter,
    uniqueAgentId,
    abortController,
    notCompletedSteps,
    isResumingFromChain,
    chainResumeInfo,
    shouldResumeFromSavedSession,
    stepDataForResume,
    shouldResumeFromPause,
    stepResumeMonitoringId,
    stepResumePrompt,
    selectedConditions,
  } = options;

  debug(`[DEBUG workflow] Checking if fallback should execute... notCompletedSteps=${JSON.stringify(notCompletedSteps)}`);

  // Check if fallback should be executed before the original step
  if (shouldExecuteFallback(step, index, notCompletedSteps)) {
    emitter.logMessage(uniqueAgentId, `Detected incomplete step. Running fallback agent first.`);
    try {
      await executeFallbackStep(step, cwd, Date.now(), step.engine ?? '', emitter, uniqueAgentId, abortController.signal);
    } catch (error) {
      // Fallback failed, step remains in notCompletedSteps
      emitter.logMessage(uniqueAgentId, `Fallback failed. Skipping original step retry.`);
      // Don't update status to failed - just let it stay as running or retrying
      throw error;
    }
  }

  debug(`[DEBUG workflow] Fallback check passed, checking chain resume...`);
  debug(`[DEBUG workflow] isResumingFromChain=${isResumingFromChain}, chainResumeInfo=${JSON.stringify(chainResumeInfo)}`);

  let stepOutput: StepOutput;
  let isResumingFromSavedSessionWithChains = false;

  if (isResumingFromChain && chainResumeInfo) {
    // Skip initial executeStep - agent already ran previously
    // Register monitoringId so TUI can load existing logs
    emitter.registerMonitoringId(uniqueAgentId, chainResumeInfo.monitoringId);

    // Mark agent as running (was paused)
    const monitor = AgentMonitorService.getInstance();
    await monitor.markRunning(chainResumeInfo.monitoringId);

    emitter.logMessage(uniqueAgentId, `Resuming from saved chain state...`);

    // Create synthetic stepOutput with saved monitoringId
    stepOutput = {
      output: '',
      monitoringId: chainResumeInfo.monitoringId,
      chainedPrompts: undefined as ChainedPrompt[] | undefined,
    };

    // Load chained prompts from agent config
    const agentConfig = await loadAgentConfig(step.agentId, cwd);
    if (agentConfig?.chainedPromptsPath) {
      stepOutput.chainedPrompts = await loadChainedPrompts(
        agentConfig.chainedPromptsPath,
        cwd,
        selectedConditions
      );
    }
  } else if (shouldResumeFromSavedSession && stepDataForResume?.monitoringId) {
    // Resume from saved session - check if agent has chained prompts
    debug(`[DEBUG workflow] Resuming from saved session path`);
    const agentConfig = await loadAgentConfig(step.agentId, cwd);
    const hasChainedPromptsConfig = !!agentConfig?.chainedPromptsPath;

    if (hasChainedPromptsConfig) {
      // Agent has chained prompts - skip re-execution, just show existing logs
      debug(`[DEBUG workflow] Agent has chained prompts - showing existing logs without re-running`);
      isResumingFromSavedSessionWithChains = true;
      emitter.registerMonitoringId(uniqueAgentId, stepDataForResume.monitoringId);

      // Mark agent as running (was paused/saved)
      const monitor = AgentMonitorService.getInstance();
      await monitor.markRunning(stepDataForResume.monitoringId);

      emitter.logMessage(uniqueAgentId, `Resuming from saved session...`);

      // Create synthetic stepOutput with saved monitoringId
      stepOutput = {
        output: '',
        monitoringId: stepDataForResume.monitoringId,
        chainedPrompts: await loadChainedPrompts(agentConfig.chainedPromptsPath!, cwd, selectedConditions),
      };
    } else {
      // No chained prompts - normal resume with re-execution
      debug(`[DEBUG workflow] No chained prompts - normal resume execution`);
      emitter.logMessage(uniqueAgentId, `Resuming from saved session (process restart)...`);

      stepOutput = await executeStep(step, cwd, {
        logger: () => {},
        stderrLogger: () => {},
        emitter,
        abortSignal: abortController.signal,
        uniqueAgentId,
        resumeMonitoringId: stepResumeMonitoringId,
        resumePrompt: stepResumePrompt,
        selectedConditions,
      });

      debug(`[DEBUG workflow] executeStep completed. monitoringId=${stepOutput.monitoringId}`);

      if (stepOutput.monitoringId !== undefined) {
        debug(`[DEBUG workflow] Initializing step session...`);
        const monitor = AgentMonitorService.getInstance();
        const agent = monitor.getAgent(stepOutput.monitoringId);
        const sessionId = agent?.sessionId ?? '';
        await initStepSession(cmRoot, index, sessionId, stepOutput.monitoringId);
        debug(`[DEBUG workflow] Step session initialized`);
      }
    }
  } else {
    debug(`[DEBUG workflow] Normal execution path (fresh start or pause resume)`);
    // Normal path - log if resuming from pause
    if (shouldResumeFromPause) {
      emitter.logMessage(uniqueAgentId, `Resuming from paused session...`);
    }

    debug(`[DEBUG workflow] About to call executeStep...`);
    // Execute the step
    stepOutput = await executeStep(step, cwd, {
      logger: () => {},
      stderrLogger: () => {},
      emitter,
      abortSignal: abortController.signal,
      uniqueAgentId,
      resumeMonitoringId: stepResumeMonitoringId,
      resumePrompt: stepResumePrompt,
      selectedConditions,
    });

    debug(`[DEBUG workflow] executeStep completed. monitoringId=${stepOutput.monitoringId}`);

    // Initialize step session with session data (for resume capability)
    // Only on fresh execution, not chain resume (session already saved)
    if (stepOutput.monitoringId !== undefined) {
      debug(`[DEBUG workflow] Initializing step session...`);
      const monitor = AgentMonitorService.getInstance();
      const agent = monitor.getAgent(stepOutput.monitoringId);
      const sessionId = agent?.sessionId ?? '';
      await initStepSession(cmRoot, index, sessionId, stepOutput.monitoringId);
      debug(`[DEBUG workflow] Step session initialized`);
    }
  }

  return { stepOutput, isResumingFromSavedSessionWithChains };
}
