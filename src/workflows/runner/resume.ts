/**
 * Resume Orchestration
 *
 * Execute step with resume logic - handles chain resume, saved session, and fresh execution.
 */

import { debug } from '../../shared/logging/logger.js';
import { initStepSession } from '../../shared/workflows/index.js';
import { AgentMonitorService } from '../../agents/monitoring/index.js';
import { loadAgentConfig } from '../../agents/runner/index.js';
import { loadChainedPrompts } from '../../agents/runner/chained.js';
import type { WorkflowEventEmitter } from '../events/index.js';
import type { ModuleStep } from '../templates/types.js';
import { executeStep, type ChainedPrompt } from '../step/execute.js';

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

export interface ExecWithResumeOptions {
  step: ModuleStep;
  cwd: string;
  cmRoot: string;
  index: number;
  emitter: WorkflowEventEmitter;
  uniqueAgentId: string;
  abortController: AbortController;
  isResumingFromChain: boolean;
  chainResumeInfo: ChainResumeInfo | null;
  shouldResumeFromSavedSession: boolean;
  stepDataForResume: StepDataForResume | null;
  shouldResumeFromPause: boolean;
  stepResumeMonitoringId: number | undefined;
  stepResumePrompt: string | undefined;
  selectedConditions: string[];
}

export interface ExecWithResumeResult {
  stepOutput: StepOutput;
  isResumingFromSavedSessionWithChains: boolean;
}

/**
 * Execute step with resume logic - handles chain resume, saved session, and fresh execution
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
    isResumingFromChain,
    chainResumeInfo,
    shouldResumeFromSavedSession,
    stepDataForResume,
    shouldResumeFromPause,
    stepResumeMonitoringId,
    stepResumePrompt,
    selectedConditions,
  } = options;

  debug(`[DEBUG workflow] isResumingFromChain=${isResumingFromChain}, chainResumeInfo=${JSON.stringify(chainResumeInfo)}`);

  let stepOutput: StepOutput;
  let isResumingFromSavedSessionWithChains = false;

  if (isResumingFromChain && chainResumeInfo) {
    emitter.registerMonitoringId(uniqueAgentId, chainResumeInfo.monitoringId);

    const monitor = AgentMonitorService.getInstance();
    await monitor.markRunning(chainResumeInfo.monitoringId);

    stepOutput = {
      output: '',
      monitoringId: chainResumeInfo.monitoringId,
      chainedPrompts: undefined as ChainedPrompt[] | undefined,
    };

    const agentConfig = await loadAgentConfig(step.agentId, cwd);
    if (agentConfig?.chainedPromptsPath) {
      stepOutput.chainedPrompts = await loadChainedPrompts(
        agentConfig.chainedPromptsPath,
        cwd,
        selectedConditions
      );
    }
  } else if (shouldResumeFromSavedSession && stepDataForResume?.monitoringId) {
    debug(`[DEBUG workflow] Resuming from saved session path`);
    const agentConfig = await loadAgentConfig(step.agentId, cwd);
    const hasChainedPromptsConfig = !!agentConfig?.chainedPromptsPath;

    if (hasChainedPromptsConfig) {
      debug(`[DEBUG workflow] Agent has chained prompts - showing existing logs without re-running`);
      isResumingFromSavedSessionWithChains = true;
      emitter.registerMonitoringId(uniqueAgentId, stepDataForResume.monitoringId);

      const monitor = AgentMonitorService.getInstance();
      await monitor.markRunning(stepDataForResume.monitoringId);

      stepOutput = {
        output: '',
        monitoringId: stepDataForResume.monitoringId,
        chainedPrompts: await loadChainedPrompts(agentConfig.chainedPromptsPath!, cwd, selectedConditions),
      };
    } else {
      debug(`[DEBUG workflow] No chained prompts - normal resume execution`);

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

    debug(`[DEBUG workflow] About to call executeStep...`);
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

  return { stepOutput, isResumingFromSavedSessionWithChains };
}
