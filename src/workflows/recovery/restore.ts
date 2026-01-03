/**
 * Crash Recovery Restoration
 *
 * Restores step state after a crash, including:
 * - Registering monitoring ID with emitter
 * - Updating agent status
 * - Restoring machine context
 * - Restoring prompt queue from completedChains
 */

import { debug } from '../../shared/logging/logger.js';
import { getNextChainIndex } from '../indexing/lifecycle.js';
import { loadAgentConfig } from '../../agents/runner/index.js';
import { loadChainedPrompts } from '../../agents/runner/chained.js';
import { getSelectedConditions } from '../../shared/workflows/template.js';
import { StatusService } from '../../agents/monitoring/index.js';
import type { CrashRestoreContext, CrashRestoreResult } from './types.js';

/**
 * Restore step state after crash recovery
 *
 * Performs all necessary restoration:
 * 1. Register monitoring ID with emitter (for log panel)
 * 2. Update agent status to 'awaiting'
 * 3. Set machine context (currentMonitoringId, currentOutput)
 * 4. Restore prompt queue from completedChains
 *
 * @param ctx - Restoration context with all dependencies
 * @returns Restoration result
 */
export async function restoreFromCrash(ctx: CrashRestoreContext): Promise<CrashRestoreResult> {
  const {
    stepData,
    step,
    stepIndex,
    uniqueAgentId,
    cwd,
    cmRoot,
    emitter,
    machineContext,
    indexManager,
    session,
  } = ctx;

  debug('[recovery/restore] Restoring step %d from crash', stepIndex);

  // 1. Register monitoring ID with emitter (for log panel connection)
  if (stepData.monitoringId !== undefined) {
    emitter.registerMonitoringId(uniqueAgentId, stepData.monitoringId);
  }

  // 2. Update agent status to awaiting
  const status = StatusService.getInstance();
  status.awaiting(uniqueAgentId);

  // 3. Set machine context
  machineContext.currentMonitoringId = stepData.monitoringId;
  machineContext.currentOutput = {
    output: '',
    monitoringId: stepData.monitoringId,
  };

  // 4. Restore queue from agent config (always try, not just when completedChains exists)
  let queueRestored = false;
  let promptCount = 0;
  let resumeIndex = 0;

  // Always try to load chained prompts from agent config
  const agentConfig = await loadAgentConfig(step.agentId, cwd);

  if (agentConfig?.chainedPromptsPath) {
    const selectedConditions = await getSelectedConditions(cmRoot);
    const chainedPrompts = await loadChainedPrompts(
      agentConfig.chainedPromptsPath,
      cwd,
      selectedConditions
    );

    if (chainedPrompts.length > 0) {
      // Use completedChains to determine resume index (or 0 if none completed yet)
      resumeIndex = stepData.completedChains && stepData.completedChains.length > 0
        ? getNextChainIndex(stepData)
        : 0;
      promptCount = chainedPrompts.length;

      debug(
        '[recovery/restore] Restoring queue: %d prompts, resuming at index %d (completedChains=%d)',
        promptCount,
        resumeIndex,
        stepData.completedChains?.length ?? 0
      );

      // Use session if available, otherwise fall back to indexManager directly
      if (session) {
        session.initializeFromPersisted(chainedPrompts, resumeIndex);
      } else {
        indexManager.initQueue(chainedPrompts, resumeIndex);
      }

      queueRestored = true;
    }
  }

  debug(
    '[recovery/restore] Restoration complete: queueRestored=%s, promptCount=%d, resumeIndex=%d',
    queueRestored,
    promptCount,
    resumeIndex
  );

  return {
    success: true,
    queueRestored,
    promptCount,
    resumeIndex,
  };
}
