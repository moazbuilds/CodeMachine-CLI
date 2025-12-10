import * as path from 'node:path';
import * as fs from 'node:fs';

import type { RunWorkflowOptions } from '../templates/index.js';
import { loadTemplateWithPath } from '../templates/index.js';
import { formatAgentLog } from '../../shared/logging/index.js';
import { formatUserInput } from '../../shared/formatters/outputMarkers.js';
import { debug, setDebugLogFile } from '../../shared/logging/logger.js';
import {
  getTemplatePathFromTracking,
  getCompletedSteps,
  getNotCompletedSteps,
  markStepCompleted,
  markStepStarted,
  initStepSession,
  updateStepSession,
  markChainCompleted,
  getChainResumeInfo,
  removeFromNotCompleted,
  getResumeStartIndex,
  getSelectedTrack,
  getSelectedConditions,
} from '../../shared/workflows/index.js';
import { registry } from '../../infra/engines/index.js';
import { shouldSkipStep, logSkipDebug, type ActiveLoop } from '../behaviors/skip.js';
import { handleLoopLogic, createActiveLoop } from '../behaviors/loop/controller.js';
import { handleTriggerLogic } from '../behaviors/trigger/controller.js';
import { handleCheckpointLogic } from '../behaviors/checkpoint/controller.js';
import { executeStep, type ChainedPrompt } from './step.js';
import { executeTriggerAgent } from './trigger.js';
import { loadAgentConfig } from '../../agents/runner/index.js';
import { loadChainedPrompts } from '../../agents/runner/chained.js';
import { shouldExecuteFallback, executeFallbackStep } from './fallback.js';
import { MonitoringCleanup, AgentLoggerService, AgentMonitorService } from '../../agents/monitoring/index.js';
import { WorkflowEventBus, WorkflowEventEmitter } from '../events/index.js';

/**
 * Cache for engine authentication status with TTL
 * Prevents repeated auth checks (which can take 10-30 seconds)
 */
class EngineAuthCache {
  private cache: Map<string, { isAuthenticated: boolean; timestamp: number }> = new Map();
  private ttlMs: number = 5 * 60 * 1000; // 5 minutes TTL

  /**
   * Check if engine is authenticated (with caching)
   */
  async isAuthenticated(engineId: string, checkFn: () => Promise<boolean>): Promise<boolean> {
    const cached = this.cache.get(engineId);
    const now = Date.now();

    // Return cached value if still valid
    if (cached && (now - cached.timestamp) < this.ttlMs) {
      return cached.isAuthenticated;
    }

    // Cache miss or expired - perform actual check
    const result = await checkFn();

    // Cache the result
    this.cache.set(engineId, {
      isAuthenticated: result,
      timestamp: now
    });

    return result;
  }

  /**
   * Invalidate cache for specific engine
   */
  invalidate(engineId: string): void {
    this.cache.delete(engineId);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global auth cache instance
const authCache = new EngineAuthCache();

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
  const workflowStartTime = Date.now();

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

  if (startIndex > 0) {
    console.log(`Resuming workflow from step ${startIndex}...`);
  }

  // Workflow stop flag for Ctrl+C handling
  let workflowShouldStop = false;
  let stoppedByCheckpointQuit = false;
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
  const inputState = {
    active: false,
    requested: false, // True when user pressed P to abort current step
    stepIndex: null as number | null,
    monitoringId: undefined as number | undefined,
    // Queue of prompts (from chained prompts config)
    queuedPrompts: [] as ChainedPrompt[],
    currentIndex: 0,
    // User input
    pendingPrompt: undefined as string | undefined,
    pendingSkip: false,
    resolver: null as (() => void) | null,
  };

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
    const shouldResumeStep = inputState.stepIndex === index && inputState.monitoringId !== undefined;
    const stepResumeMonitoringId = shouldResumeStep ? inputState.monitoringId : undefined;
    const stepResumePrompt = shouldResumeStep ? inputState.pendingPrompt : undefined;

    // DEBUG
    debug(`[DEBUG workflow] shouldResumeStep=${shouldResumeStep}, stepResumePrompt="${stepResumePrompt}"`);

    // Reset input state after using it for resume
    if (shouldResumeStep) {
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

    // Determine engine: step override > first authenticated engine
    let engineType: string;
    if (step.engine) {
      debug(`[DEBUG workflow] Using step-specified engine: ${step.engine}`);
      engineType = step.engine;

      // If an override is provided but not authenticated, log and fall back
      const overrideEngine = registry.get(engineType);
      debug(`[DEBUG workflow] Checking auth for override engine...`);
      const isOverrideAuthed = overrideEngine
        ? await authCache.isAuthenticated(overrideEngine.metadata.id, () => overrideEngine.auth.isAuthenticated())
        : false;
      debug(`[DEBUG workflow] isOverrideAuthed=${isOverrideAuthed}`);
      if (!isOverrideAuthed) {
        const pretty = overrideEngine?.metadata.name ?? engineType;
        const authMsg = `${pretty} override is not authenticated; falling back to first authenticated engine by order. Run 'codemachine auth login' to use ${pretty}.`;
        emitter.logMessage(uniqueAgentId, authMsg);

        // Find first authenticated engine by order (with caching)
        const engines = registry.getAll();
        let fallbackEngine = null as typeof overrideEngine | null;
        for (const eng of engines) {
          const isAuth = await authCache.isAuthenticated(
            eng.metadata.id,
            () => eng.auth.isAuthenticated()
          );
          if (isAuth) {
            fallbackEngine = eng;
            break;
          }
        }

        // If none authenticated, fall back to registry default (may still require auth)
        if (!fallbackEngine) {
          fallbackEngine = registry.getDefault() ?? null;
        }

        if (fallbackEngine) {
          engineType = fallbackEngine.metadata.id;
          const fallbackMsg = `Falling back to ${fallbackEngine.metadata.name} (${engineType})`;
          emitter.logMessage(uniqueAgentId, fallbackMsg);
        }
      }
    } else {
      debug(`[DEBUG workflow] No step.engine specified, finding authenticated engine...`);
      // Fallback: find first authenticated engine by order (with caching)
      const engines = registry.getAll();
      debug(`[DEBUG workflow] Available engines: ${engines.map(e => e.metadata.id).join(', ')}`);
      let foundEngine = null;

      for (const engine of engines) {
        debug(`[DEBUG workflow] Checking auth for engine: ${engine.metadata.id}`);
        const isAuth = await authCache.isAuthenticated(
          engine.metadata.id,
          () => engine.auth.isAuthenticated()
        );
        debug(`[DEBUG workflow] Engine ${engine.metadata.id} isAuth=${isAuth}`);
        if (isAuth) {
          foundEngine = engine;
          break;
        }
      }

      if (!foundEngine) {
        debug(`[DEBUG workflow] No authenticated engine found, using default`);
        // If no authenticated engine, use default (first by order)
        foundEngine = registry.getDefault();
      }

      if (!foundEngine) {
        debug(`[DEBUG workflow] No engines registered at all!`);
        throw new Error('No engines registered. Please install at least one engine.');
      }

      engineType = foundEngine.metadata.id;
      debug(`[DEBUG workflow] Selected engine: ${engineType}`);
      const engineMsg = `No engine specified, using ${foundEngine.metadata.name} (${engineType})`;
      emitter.logMessage(uniqueAgentId, engineMsg);
    }

    debug(`[DEBUG workflow] Engine determined: ${engineType}`);
    // Ensure the selected engine is used during execution
    // (executeStep falls back to default engine if step.engine is unset)
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
      debug(`[DEBUG workflow] Checking if fallback should execute... notCompletedSteps=${JSON.stringify(notCompletedSteps)}`);
      // Check if fallback should be executed before the original step
      if (shouldExecuteFallback(step, index, notCompletedSteps)) {
        emitter.logMessage(uniqueAgentId, `Detected incomplete step. Running fallback agent first.`);
        try {
          await executeFallbackStep(step, cwd, workflowStartTime, engineType, emitter, uniqueAgentId, abortController.signal);
        } catch (error) {
          // Fallback failed, step remains in notCompletedSteps
          emitter.logMessage(uniqueAgentId, `Fallback failed. Skipping original step retry.`);
          // Don't update status to failed - just let it stay as running or retrying
          throw error;
        }
      }

      debug(`[DEBUG workflow] Fallback check passed, checking chain resume...`);
      // Check if resuming from saved chain state BEFORE execution
      const isResumingFromChain = chainResumeInfo && chainResumeInfo.stepIndex === index;
      debug(`[DEBUG workflow] isResumingFromChain=${isResumingFromChain}, chainResumeInfo=${JSON.stringify(chainResumeInfo)}`);

      let stepOutput;

      if (isResumingFromChain) {
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
            cwd
          );
        }
      } else {
        debug(`[DEBUG workflow] Normal execution path (not resuming from chain)`);
        // Normal path - log if resuming from pause
        if (stepResumeMonitoringId) {
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

      debug(`[DEBUG workflow] Checking for chained prompts...`);
      // Unified input handling - activates for both:
      // 1. Resume from pause with custom prompt (steering)
      // 2. Chained prompts from workflow config
      const hasChainedPrompts = stepOutput.chainedPrompts && stepOutput.chainedPrompts.length > 0;
      const shouldEnterInputLoop = (stepResumePrompt && stepResumeMonitoringId) || hasChainedPrompts || isResumingFromChain;
      debug(`[DEBUG workflow] hasChainedPrompts=${hasChainedPrompts}, shouldEnterInputLoop=${shouldEnterInputLoop}`);

      if (shouldEnterInputLoop) {
        // Initialize input state
        inputState.active = true;
        inputState.monitoringId = isResumingFromChain
          ? chainResumeInfo.monitoringId
          : stepOutput.monitoringId;
        inputState.queuedPrompts = hasChainedPrompts ? stepOutput.chainedPrompts! : [];
        // Resume from saved chain index if available
        inputState.currentIndex = isResumingFromChain
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
        } else {
          if (isResumingFromChain) {
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
        }

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
          stepOutput = await executeStep(step, cwd, {
            logger: () => {},
            stderrLogger: () => {},
            emitter,
            abortSignal: abortController.signal,
            uniqueAgentId,
            resumeMonitoringId: inputState.monitoringId,
            resumePrompt: promptToUse,
          });

          // Update monitoring ID for next iteration
          inputState.monitoringId = stepOutput.monitoringId;

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

      // Check for trigger behavior first
      const triggerResult = await handleTriggerLogic(step, stepOutput.output, cwd, emitter);
      if (triggerResult?.shouldTrigger && triggerResult.triggerAgentId) {
        const triggeredAgentId = triggerResult.triggerAgentId; // Capture for use in callbacks
        try {
          await executeTriggerAgent({
            triggerAgentId: triggeredAgentId,
            cwd,
            engineType,
            logger: () => {}, // No-op: UI reads from log files
            stderrLogger: () => {}, // No-op: UI reads from log files
            sourceAgentId: uniqueAgentId,
            emitter,
            abortSignal: abortController.signal,
          });
        } catch (triggerError) {
          // Check if this was a user-requested skip (abort)
          if (triggerError instanceof Error && triggerError.name === 'AbortError') {
            emitter.updateAgentStatus(triggeredAgentId, 'skipped');
            emitter.logMessage(triggeredAgentId, `Triggered agent was skipped by user.`);
          }
          // Continue with workflow even if triggered agent fails or is skipped
        }
      }

      // Remove from notCompletedSteps immediately after successful execution
      // This must happen BEFORE loop logic to ensure cleanup even when loops trigger
      await removeFromNotCompleted(cmRoot, index);

      // Mark step as completed if executeOnce is true
      if (step.executeOnce) {
        await markStepCompleted(cmRoot, index);
      }

      // Update UI status to completed
      // This must happen BEFORE loop logic to ensure UI updates even when loops trigger
      emitter.updateAgentStatus(uniqueAgentId, 'completed');

      // Log completion messages BEFORE loop check (so they're part of current agent's output)
      emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
      emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');

      // Check for checkpoint behavior first (to pause workflow for manual review)
      const checkpointResult = await handleCheckpointLogic(step, stepOutput.output, cwd, emitter);
      if (checkpointResult?.shouldStopWorkflow) {
        // Wait for user action via events (Continue or Quit)
        await new Promise<void>((resolve) => {
          const continueHandler = () => {
            cleanup();
            resolve();
          };
          const quitHandler = () => {
            cleanup();
            workflowShouldStop = true;
            stoppedByCheckpointQuit = true;
            resolve();
          };
          const cleanup = () => {
            process.removeListener('checkpoint:continue', continueHandler);
            process.removeListener('checkpoint:quit', quitHandler);
          };

          process.once('checkpoint:continue', continueHandler);
          process.once('checkpoint:quit', quitHandler);
        });

        // Clear checkpoint state and resume
        emitter.clearCheckpointState();

        if (workflowShouldStop) {
          // User chose to quit from checkpoint - set status to stopped
          emitter.setWorkflowStatus('stopped');
          break; // User chose to quit
        }
        // Otherwise continue to next step (current step already marked complete via executeOnce)
      }

      const loopResult = await handleLoopLogic(step, index, stepOutput.output, loopCounters, cwd, emitter);

      if (loopResult.decision?.shouldRepeat) {
        // Set active loop with skip list
        activeLoop = createActiveLoop(loopResult.decision);

        // Update UI loop state
        const loopKey = `${step.module?.id ?? step.agentId}:${index}`;
        const iteration = (loopCounters.get(loopKey) || 0) + 1;
        const loopState = {
          active: true,
          sourceAgent: uniqueAgentId,
          backSteps: loopResult.decision.stepsBack,
          iteration,
          maxIterations: step.module?.behavior?.type === 'loop' ? step.module.behavior.maxIterations ?? Infinity : Infinity,
          skipList: loopResult.decision.skipList || [],
          reason: loopResult.decision.reason,
        };
        emitter.setLoopState(loopState);

        // Reset all agents that will be re-executed in the loop
        // Clear their UI data (telemetry, tool counts, subagents) and monitoring registry data
        // Save their current state to execution history with cycle number
        for (let resetIndex = loopResult.newIndex; resetIndex <= index; resetIndex += 1) {
          const resetStep = template.steps[resetIndex];
          if (resetStep && resetStep.type === 'module') {
            const resetUniqueAgentId = `${resetStep.agentId}-step-${resetIndex}`;
            emitter.resetAgentForLoop(resetUniqueAgentId, iteration);
          }
        }

        index = loopResult.newIndex;
        continue;
      }

      // Clear active loop only when a loop step explicitly terminates
      const newActiveLoop = createActiveLoop(loopResult.decision);
      if (newActiveLoop !== (undefined as unknown as ActiveLoop | null)) {
        activeLoop = newActiveLoop;
        if (!newActiveLoop) {
          emitter.setLoopState(null);
          emitter.clearLoopRound(uniqueAgentId);
        }
      }
    } catch (error) {
      // Check if this was a pause request (process killed)
      if (inputState.requested) {
        emitter.logMessage(uniqueAgentId, `${step.agentName} paused.`);

        // Store step index and activate input state for resume
        inputState.stepIndex = index;
        inputState.active = true;
        inputState.requested = false;

        // Emit input state to TUI
        emitter.setInputState({
          active: true,
          queuedPrompts: [],
          currentIndex: 0,
          monitoringId: inputState.monitoringId,
        });

        // Wait for user input
        await new Promise<void>((resolve) => {
          inputState.resolver = resolve;
        });

        // Re-run this step by not incrementing index (continue skips the for-loop increment)
        index -= 1;
      } else if (error instanceof Error && error.name === 'AbortError') {
        // Check if this was a user-requested skip (abort)
        debug(`[DEBUG workflow] Step ${index} (${uniqueAgentId}) was aborted by user`);
        emitter.updateAgentStatus(uniqueAgentId, 'skipped');
        emitter.logMessage(uniqueAgentId, `${step.agentName} was skipped by user.`);
        emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
        // Continue to next step - don't throw
      } else {
        // Error occurred - log it and stop the workflow
        debug(`[DEBUG workflow] Step ${index} (${uniqueAgentId}) failed with error: ${error instanceof Error ? error.message : String(error)}`);

        // Check if it's a file not found error
        if (error instanceof Error && (error.message.includes('ENOENT') || error.message.includes('not found'))) {
          const errorMsg = `CRITICAL ERROR: ${step.agentName} failed - required file not found: ${error.message}`;
          emitter.updateAgentStatus(uniqueAgentId, 'failed');
          emitter.logMessage(uniqueAgentId, errorMsg);

          // Set workflow status to stopped and stop
          emitter.setWorkflowStatus('stopped');
          workflowShouldStop = true;
        } else {
          // Generic error - log and stop
          const failMsg = `${step.agentName} failed: ${error instanceof Error ? error.message : String(error)}`;
          emitter.logMessage(uniqueAgentId, failMsg);
          emitter.updateAgentStatus(uniqueAgentId, 'failed');

          // Set workflow status to stopped and stop
          emitter.setWorkflowStatus('stopped');
          workflowShouldStop = true;
        }
      }
    } finally {
      // Always clean up the skip listener
      process.removeListener('workflow:skip', skipListener);
    }
  }

  debug(`[DEBUG workflow] Step loop ended. workflowShouldStop=${workflowShouldStop}, stoppedByCheckpointQuit=${stoppedByCheckpointQuit}`);

  // Check if workflow was stopped by user (Ctrl+C or checkpoint quit)
  if (workflowShouldStop) {
    if (stoppedByCheckpointQuit) {
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

    emitter.logMessage('workflow', `\n${'═'.repeat(80)}\nWORKFLOW FAILED\n${'═'.repeat(80)}`);
    emitter.logMessage('workflow', `Error: ${errorMsg}`);

    emitter.setWorkflowStatus('stopped');

    // Re-throw error to be handled by caller (will now print after UI is stopped)
    throw error;
  } finally {
    // Clean up workflow listeners
    process.removeListener('workflow:stop', stopListener);
    process.removeListener('workflow:pause', pauseListener);
    process.removeListener('workflow:input', inputListener);
  }
}
