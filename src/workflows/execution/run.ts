import * as path from 'node:path';
import * as fs from 'node:fs';

import type { RunWorkflowOptions } from '../templates/index.js';
import { loadTemplateWithPath } from '../templates/index.js';
import { formatAgentLog } from '../../shared/logging/index.js';
import { debug, setDebugLogFile } from '../../shared/logging/logger.js';
import {
  getTemplatePathFromTracking,
  getCompletedSteps,
  getNotCompletedSteps,
  markStepStarted,
  getChainResumeInfo,
  getResumeStartIndex,
  getSelectedTrack,
  getSelectedConditions,
  getStepData,
} from '../../shared/workflows/index.js';
import { registry } from '../../infra/engines/index.js';
import { shouldSkipStep, logSkipDebug, type ActiveLoop } from '../behaviors/skip.js';
import { MonitoringCleanup } from '../../agents/monitoring/index.js';
import { WorkflowEventBus, WorkflowEventEmitter } from '../events/index.js';

import { selectEngine } from './auth.js';
import { createInputState, handleInputLoop, type InputState } from './input.js';
import { execWithResume } from './resume.js';
import { handlePostExec } from './post.js';
import { handleStepError } from './errors.js';

export async function runWorkflow(options: RunWorkflowOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

  // Redirect debug logs to file whenever LOG_LEVEL=debug (or DEBUG env is truthy) so they don't break Ink layout
  const rawLogLevel = (process.env.LOG_LEVEL || '').trim().toLowerCase();
  const debugFlag = (process.env.DEBUG || '').trim().toLowerCase();
  const debugEnabled = rawLogLevel === 'debug' || (debugFlag !== '' && debugFlag !== '0' && debugFlag !== 'false');
  const isDebugLogLevel = debugEnabled;
  const debugLogPath = isDebugLogLevel ? path.join(cwd, '.codemachine', 'logs', 'workflow-debug.log') : null;
  setDebugLogFile(debugLogPath);

  // Set up cleanup handlers for graceful shutdown
  MonitoringCleanup.setup();

  // Load template from .codemachine/template.json or use provided path
  const cmRoot = path.join(cwd, '.codemachine');
  const templatePath = options.templatePath || (await getTemplatePathFromTracking(cmRoot));

  const { template } = await loadTemplateWithPath(cwd, templatePath);

  debug(`Using workflow template: ${template.name}`);

  // Sync agent configurations before running the workflow
  const workflowAgents = Array.from(
    template.steps
      .filter((step) => step.type === 'module')
      .reduce((acc, step) => {
        const id = step.agentId?.trim();
        if (!id) return acc;
        const existing = acc.get(id) ?? { id };
        acc.set(id, {
          ...existing,
          id,
          model: step.model ?? existing.model,
          modelReasoningEffort: step.modelReasoningEffort ?? existing.modelReasoningEffort,
        });
        return acc;
      }, new Map<string, { id: string; model?: unknown; modelReasoningEffort?: unknown }>()).values(),
  );

  // Sync agent configurations for engines that need it
  if (workflowAgents.length > 0) {
    const engines = registry.getAll();
    for (const engine of engines) {
      if (engine.syncConfig) {
        await engine.syncConfig({ additionalAgents: workflowAgents });
      }
    }
  }

  // Load completed steps for executeOnce tracking
  const completedSteps = await getCompletedSteps(cmRoot);

  // Load not completed steps for fallback tracking
  const notCompletedSteps = await getNotCompletedSteps(cmRoot);

  // Load selected track for track-based filtering
  const selectedTrack = await getSelectedTrack(cmRoot);

  // Load selected conditions for condition-based filtering
  const selectedConditions = await getSelectedConditions(cmRoot);

  // Load chain resume info (for resuming mid-chain)
  const chainResumeInfo = await getChainResumeInfo(cmRoot);

  const loopCounters = new Map<string, number>();
  let activeLoop: ActiveLoop | null = null;

  // Get Event Bus from global (created by app.tsx before workflow starts)
  // Or create a new one if running standalone (e.g., CLI without TUI)
  // @ts-expect-error - global export from app.tsx
  const eventBus: WorkflowEventBus = globalThis.__workflowEventBus ?? new WorkflowEventBus();
  const emitter = new WorkflowEventEmitter(eventBus);

  // Export event bus globally in case it was created here (standalone mode)
  // @ts-expect-error - global export for TUI adapter connection
  if (!globalThis.__workflowEventBus) {
    // @ts-expect-error - global export
    globalThis.__workflowEventBus = eventBus;
  }

  // Emit workflow started event
  // Count only module steps that match the selected track and conditions
  const totalModuleSteps = template.steps.filter(s => {
    if (s.type !== 'module') return false;
    // Include step if: no tracks defined OR selectedTrack is in tracks list
    if (s.tracks?.length && selectedTrack && !s.tracks.includes(selectedTrack)) {
      return false;
    }
    // Include step if: no conditions defined OR all conditions are met
    if (s.conditions?.length) {
      const missingConditions = s.conditions.filter(c => !selectedConditions.includes(c));
      if (missingConditions.length > 0) return false;
    }
    return true;
  }).length;
  emitter.workflowStarted(template.name, totalModuleSteps);

  // Pre-populate timeline with workflow steps that match selected track and conditions
  // This prevents duplicate renders at startup
  // Set initial status based on completion tracking
  template.steps.forEach((step, stepIndex) => {
    if (step.type === 'module') {
      // Track filtering: skip steps not in selected track
      if (step.tracks?.length && selectedTrack && !step.tracks.includes(selectedTrack)) {
        return; // Don't add to UI
      }
      // Condition filtering: skip steps with unmet conditions
      if (step.conditions?.length) {
        const missingConditions = step.conditions.filter(c => !selectedConditions.includes(c));
        if (missingConditions.length > 0) return; // Don't add to UI
      }

      const defaultEngine = registry.getDefault();
      const engineType = step.engine ?? defaultEngine?.metadata.id ?? 'unknown';
      const engineName = engineType; // preserve original engine type, even if unknown

      // Create a unique identifier for each step instance (agentId + stepIndex)
      // This allows multiple instances of the same agent to appear separately in the UI
      const uniqueAgentId = `${step.agentId}-step-${stepIndex}`;

      // Determine initial status based on completion tracking
      let initialStatus: 'pending' | 'completed' = 'pending';
      if (completedSteps.includes(stepIndex)) {
        initialStatus = 'completed';
      }

      emitter.addMainAgent(
        uniqueAgentId,
        step.agentName ?? step.agentId,
        engineName,
        stepIndex,
        totalModuleSteps,
        initialStatus,
        step.model
      );
    } else if (step.type === 'ui') {
      emitter.addUIElement(step.text, stepIndex);
    }
  });

  // Get the starting index based on resume configuration
  const startIndex = await getResumeStartIndex(cmRoot);

  debug(`[DEBUG workflow] startIndex=${startIndex}, template.steps.length=${template.steps.length}`);

  // Load step data for session resume (when restarting after crash/kill)
  // This enables resuming OpenCode sessions that were interrupted
  // Note: startIndex can be 0 if the first step is incomplete
  const stepDataForResume = notCompletedSteps.includes(startIndex)
    ? await getStepData(cmRoot, startIndex)
    : null;

  if (stepDataForResume?.sessionId) {
    debug(`[DEBUG workflow] Found saved session for step ${startIndex}: sessionId=${stepDataForResume.sessionId}, monitoringId=${stepDataForResume.monitoringId}`);
  }

  if (startIndex > 0) {
    console.log(`Resuming workflow from step ${startIndex}...`);
  }

  // Workflow stop flag for Ctrl+C handling
  let workflowShouldStop = false;
  let stoppedByCheckpointQuit = false;
  let stoppedByError: Error | null = null; // Track if stopped due to error (for headless mode)
  let currentAbortController: AbortController | null = null; // Separate - different lifecycle
  const stopListener = () => {
    workflowShouldStop = true;
    // Also abort the current agent execution
    if (currentAbortController) {
      currentAbortController.abort();
    }
  };
  process.on('workflow:stop', stopListener);

  // Unified input state - handles both pause and chained prompts
  const inputState: InputState = createInputState();

  // Pause listener - aborts current step and activates input waiting
  const pauseListener = () => {
    if (!inputState.active) {
      inputState.requested = true;

      // Abort the current step using its abort controller
      if (currentAbortController) {
        debug(`[PAUSE] Aborting current step via AbortController`);
        currentAbortController.abort();
      }

      // Don't set active here - the catch block will handle it after abort
      emitter.setWorkflowStatus('paused');
    }
  };

  // Unified input listener - handles all user input (pause resume, chained prompts, steering)
  const inputListener = (data?: { prompt?: string; skip?: boolean }) => {
    debug(`[DEBUG workflow] inputListener received: prompt="${data?.prompt}", skip=${data?.skip}`);

    inputState.pendingPrompt = data?.prompt;
    inputState.pendingSkip = data?.skip ?? false;

    if (inputState.resolver) {
      inputState.resolver();
      inputState.resolver = null;
    }
  };

  process.on('workflow:pause', pauseListener);
  process.on('workflow:input', inputListener);

  try {
    debug(`[DEBUG workflow] Entering step loop. startIndex=${startIndex}, totalSteps=${template.steps.length}, workflowShouldStop=${workflowShouldStop}`);

    for (let index = startIndex; index < template.steps.length; index += 1) {
    debug(`[DEBUG workflow] Loop iteration index=${index}, workflowShouldStop=${workflowShouldStop}`);

    // Check if workflow should stop (Ctrl+C pressed)
    if (workflowShouldStop) {
      console.log(formatAgentLog('workflow', 'Workflow stopped by user.'));
      break;
    }

    // Check if input state is active - wait until user provides input
    if (inputState.active) {
      inputState.stepIndex = index;
      await new Promise<void>((resolve) => {
        inputState.resolver = resolve;
      });
    }

    // Determine if this step should resume (we have monitoringId from previous pause)
    const shouldResumeFromPause = inputState.stepIndex === index && inputState.monitoringId !== undefined;

    // Check for session resume after process restart (saved session data from template.json)
    const shouldResumeFromSavedSession = !shouldResumeFromPause
      && index === startIndex
      && stepDataForResume?.sessionId
      && stepDataForResume?.monitoringId;

    const stepResumeMonitoringId = shouldResumeFromPause
      ? inputState.monitoringId
      : (shouldResumeFromSavedSession ? stepDataForResume.monitoringId : undefined);
    const stepResumePrompt = shouldResumeFromPause ? inputState.pendingPrompt : undefined;

    // DEBUG
    debug(`[DEBUG workflow] shouldResumeFromPause=${shouldResumeFromPause}, shouldResumeFromSavedSession=${shouldResumeFromSavedSession}, stepResumeMonitoringId=${stepResumeMonitoringId}, stepResumePrompt="${stepResumePrompt}"`);

    // Reset input state after using it for resume
    if (shouldResumeFromPause) {
      inputState.stepIndex = null;
      inputState.monitoringId = undefined;
      inputState.pendingPrompt = undefined;
      inputState.requested = false;
      inputState.active = false;
    }

    const step = template.steps[index];
    debug(`[DEBUG workflow] Step ${index}: type=${step.type}, agentId=${'agentId' in step ? step.agentId : 'N/A'}`);

    // UI elements are pre-populated and don't need execution
    if (step.type === 'ui') {
      debug(`[DEBUG workflow] Step ${index} is UI type, skipping`);
      continue;
    }

    if (step.type !== 'module') {
      debug(`[DEBUG workflow] Step ${index} is not module type, skipping`);
      continue;
    }

    // Create unique agent ID for this step instance (matches UI pre-population)
    const uniqueAgentId = `${step.agentId}-step-${index}`;

    const skipResult = shouldSkipStep(step, index, completedSteps, activeLoop, uniqueAgentId, emitter, selectedTrack, selectedConditions);
    if (skipResult.skip) {
      debug(`[DEBUG workflow] Step ${index} (${uniqueAgentId}) skipped: ${skipResult.reason}`);
      emitter.logMessage(uniqueAgentId, skipResult.reason!);
      continue;
    }

    debug(`[DEBUG workflow] Step ${index} (${uniqueAgentId}) will execute`);
    logSkipDebug(step, activeLoop);

    debug(`[DEBUG workflow] Updating UI status to running...`);
    emitter.updateAgentStatus(uniqueAgentId, 'running');

    emitter.logMessage(uniqueAgentId, '═'.repeat(80));
    emitter.logMessage(uniqueAgentId, `${step.agentName} started to work.`);

    debug(`[DEBUG workflow] Resetting behavior file...`);
    // Reset behavior file to default "continue" before each agent run
    const behaviorFile = path.join(cwd, '.codemachine/memory/behavior.json');
    const behaviorDir = path.dirname(behaviorFile);
    if (!fs.existsSync(behaviorDir)) {
      fs.mkdirSync(behaviorDir, { recursive: true });
    }
    fs.writeFileSync(behaviorFile, JSON.stringify({ action: 'continue' }, null, 2));

    debug(`[DEBUG workflow] Marking step as started...`);
    // Mark step as started (adds to notCompletedSteps)
    await markStepStarted(cmRoot, index);
    debug(`[DEBUG workflow] Step marked as started, determining engine...`);
    debug(`[DEBUG workflow] step.engine=${step.engine}`);

    // Determine engine using extracted function
    const engineType = await selectEngine(step, emitter, uniqueAgentId);
    // Mutate current step to carry the chosen engine forward
    step.engine = engineType;

    debug(`[DEBUG workflow] Resolving model...`);
    // Resolve model: step override > engine default, and update UI
    const engineModule = registry.get(engineType);
    const resolvedModel = step.model ?? engineModule?.metadata.defaultModel;
    debug(`[DEBUG workflow] resolvedModel=${resolvedModel}`);
    if (resolvedModel) {
      emitter.updateAgentModel(uniqueAgentId, resolvedModel);
    }

    debug(`[DEBUG workflow] Setting up abort controller and skip listener...`);
    // Set up skip listener and abort controller for this step (covers fallback + main + triggers)
    const abortController = new AbortController();
    currentAbortController = abortController; // Track for pause functionality
    let skipRequested = false; // Prevent duplicate skip requests during async abort handling
    const skipListener = () => {
      if (skipRequested) {
        // Ignore duplicate skip events (user pressing Ctrl+S rapidly)
        // This prevents multiple "Skip requested" messages during Bun.spawn's async termination
        return;
      }
      skipRequested = true;
      emitter.logMessage(uniqueAgentId, '⏭️  Skip requested by user...');
      abortController.abort();
    };
    process.once('workflow:skip', skipListener);

    debug(`[DEBUG workflow] Entering try block...`);
    try {
      // Check if resuming from saved chain state BEFORE execution
      const isResumingFromChain = chainResumeInfo && chainResumeInfo.stepIndex === index;
      debug(`[DEBUG workflow] isResumingFromChain=${isResumingFromChain}, chainResumeInfo=${JSON.stringify(chainResumeInfo)}`);

      // Execute step with resume logic
      const { stepOutput, isResumingFromSavedSessionWithChains } = await execWithResume({
        step,
        cwd,
        cmRoot,
        index,
        emitter,
        uniqueAgentId,
        abortController,
        notCompletedSteps,
        isResumingFromChain: !!isResumingFromChain,
        chainResumeInfo: isResumingFromChain ? chainResumeInfo : null,
        shouldResumeFromSavedSession: !!shouldResumeFromSavedSession,
        stepDataForResume,
        shouldResumeFromPause,
        stepResumeMonitoringId,
        stepResumePrompt,
      });

      debug(`[DEBUG workflow] Checking for chained prompts...`);

      // Handle chained prompts and input loop
      await handleInputLoop({
        inputState,
        stepOutput,
        step,
        cwd,
        cmRoot,
        index,
        emitter,
        uniqueAgentId,
        abortController,
        isResumingFromChain: !!isResumingFromChain,
        chainResumeInfo: isResumingFromChain ? chainResumeInfo : null,
        isResumingFromSavedSessionWithChains,
        stepResumePrompt,
        stepResumeMonitoringId,
      });

      // Handle post-execution behaviors
      const postResult = await handlePostExec({
        step,
        stepOutput,
        cwd,
        cmRoot,
        index,
        emitter,
        uniqueAgentId,
        abortController,
        template,
        loopCounters,
        activeLoop,
        engineType,
      });

      if (postResult.shouldBreak) {
        if (postResult.stoppedByCheckpointQuit) {
          stoppedByCheckpointQuit = true;
        }
        if (postResult.workflowShouldStop) {
          workflowShouldStop = true;
        }
        break;
      }

      if (postResult.newIndex !== undefined) {
        index = postResult.newIndex;
        activeLoop = postResult.newActiveLoop ?? null;
        continue;
      }

      if (postResult.newActiveLoop !== undefined) {
        activeLoop = postResult.newActiveLoop;
      }
    } catch (error) {
      const errorResult = await handleStepError({
        error,
        step,
        index,
        inputState,
        emitter,
        uniqueAgentId,
      });

      if (errorResult.adjustIndex !== 0) {
        index += errorResult.adjustIndex;
      }

      if (errorResult.shouldStop) {
        workflowShouldStop = true;
        // Store error for headless mode - allows proper error propagation
        if (error instanceof Error) {
          stoppedByError = error;
        } else {
          stoppedByError = new Error(String(error));
        }
        break; // Exit loop immediately on error
      }
    } finally {
      // Always clean up the skip listener
      process.removeListener('workflow:skip', skipListener);
    }
  }

  debug(`[DEBUG workflow] Step loop ended. workflowShouldStop=${workflowShouldStop}, stoppedByCheckpointQuit=${stoppedByCheckpointQuit}, stoppedByError=${stoppedByError ? 'yes' : 'no'}`);

  // Check if workflow was stopped by user (Ctrl+C or checkpoint quit) or error
  if (workflowShouldStop) {
    // Check if stopped due to an error - throw it to propagate to caller (headless mode)
    if (stoppedByError) {
      // In headless mode, this will be caught by start.command.ts and printed
      // In TUI mode, the error was already handled by handleStepError (toast shown)
      // Check if we have a TUI by seeing if the event bus has subscribers
      // (TUI mode creates event bus BEFORE workflow runs and connects adapter)
      const hasTUI = eventBus.hasSubscribers();
      debug(`[DEBUG workflow] stoppedByError - hasTUI=${hasTUI}`);
      if (!hasTUI) {
        // Headless mode - throw error to be handled by caller
        throw stoppedByError;
      }
      // TUI mode - wait for user to press Ctrl+C to exit
      await new Promise(() => {
        // Never resolves - keeps event loop alive until Ctrl+C exits process
      });
    } else if (stoppedByCheckpointQuit) {
      // Workflow was stopped by checkpoint quit - status already set to 'stopped'
      // UI will stay running showing the stopped status
      // Wait indefinitely - user can press Ctrl+C to exit
      await new Promise(() => {
        // Never resolves - keeps event loop alive until Ctrl+C exits process
      });
    } else {
      // Workflow was stopped by Ctrl+C - status already updated by MonitoringCleanup handler
      // Keep UI alive to show "Press Ctrl+C again to exit" message
      // The second Ctrl+C will be handled by MonitoringCleanup's SIGINT handler
      // Wait indefinitely - the SIGINT handler will call process.exit()
      await new Promise(() => {
        // Never resolves - keeps event loop alive until second Ctrl+C exits process
      });
    }
  }

  // Workflow completed successfully
  // Note: Don't clear workflow handlers - they need to stay registered
  // for the two-stage Ctrl+C behavior to work after completion

  // Set status to completed and keep UI alive
  emitter.setWorkflowStatus('completed');
  // UI will stay running - user presses Ctrl+C to exit with two-stage behavior
  // Wait indefinitely - the SIGINT handler will call process.exit()
  await new Promise(() => {
    // Never resolves - keeps event loop alive until Ctrl+C exits process
  });
  } catch (error) {
    // On workflow error, set status, stop UI, then exit
    debug(`[DEBUG workflow] FATAL ERROR: ${error instanceof Error ? error.message : String(error)}`);
    debug(`[DEBUG workflow] Error stack: ${error instanceof Error ? error.stack : 'No stack'}`);

    const errorMsg = error instanceof Error ? error.message : String(error);

    // Set workflow status to error and emit error event for modal
    // Don't log to output window - the modal will display the error
    emitter.setWorkflowStatus('error');
    (process as NodeJS.EventEmitter).emit('workflow:error', { reason: errorMsg });

    // Re-throw error to be handled by caller (will now print after UI is stopped)
    throw error;
  } finally {
    // Clean up workflow listeners
    process.removeListener('workflow:stop', stopListener);
    process.removeListener('workflow:pause', pauseListener);
    process.removeListener('workflow:input', inputListener);
  }
}
