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
import { shouldExecuteFallback, executeFallbackStep } from './fallback.js';
import { WorkflowUIManager } from '../../ui/index.js';
import { MonitoringCleanup, AgentLoggerService } from '../../agents/monitoring/index.js';
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

  // Initialize Workflow UI Manager (old UI - will be removed after migration)
  const ui = new WorkflowUIManager(template.name);
  if (debugLogPath) {
    ui.setDebugLogPath(debugLogPath);
  }

  // Wrap registerMonitoringId to also emit to event bus for new OpenTUI
  const originalRegisterMonitoringId = ui.registerMonitoringId.bind(ui);
  ui.registerMonitoringId = (uiAgentId: string, monitoringAgentId: number) => {
    originalRegisterMonitoringId(uiAgentId, monitoringAgentId);
    emitter.registerMonitoringId(uiAgentId, monitoringAgentId);
  };

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

      // Old UI (will be removed)
      const agentId = ui.addMainAgent(step.agentName ?? step.agentId, engineName, stepIndex, initialStatus, uniqueAgentId);

      // New event system - emit agent added
      emitter.addMainAgent(
        uniqueAgentId,
        step.agentName ?? step.agentId,
        engineName,
        stepIndex,
        totalModuleSteps,
        initialStatus,
        step.model
      );

      // Update agent with step information
      const state = ui.getState();
      const agent = state.agents.find(a => a.id === agentId);
      if (agent) {
        agent.stepIndex = stepIndex;
        agent.totalSteps = totalModuleSteps;
      }
    } else if (step.type === 'ui') {
      // Pre-populate UI elements
      ui.addUIElement(step.text, stepIndex);
      // New event system - emit UI element
      emitter.addUIElement(step.text, stepIndex);
    }
  });

  // Start UI after all agents are pre-populated (single clean render)
  ui.start();

  // Get the starting index based on resume configuration
  const startIndex = await getResumeStartIndex(cmRoot);

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

  // Workflow pause handling - consolidated state
  const pauseState = {
    paused: false,
    requested: false,
    stepIndex: null as number | null,
    monitoringId: undefined as number | undefined,
    resumePrompt: undefined as string | undefined,
    resolver: null as (() => void) | null,
  };

  // Chained prompts handling state
  const chainedState = {
    active: false,
    prompts: [] as ChainedPrompt[],
    currentIndex: 0,
    monitoringId: undefined as number | undefined,
    pendingAction: null as { type: 'custom' | 'next' | 'skip'; prompt?: string } | null,
    resolver: null as (() => void) | null,
  };

  const pauseListener = () => {
    if (!pauseState.paused) {
      pauseState.paused = true;
      pauseState.requested = true;

      // Abort the current step using its abort controller
      if (currentAbortController) {
        debug(`[PAUSE] Aborting current step via AbortController`);
        currentAbortController.abort();
      }

      emitter.setWorkflowStatus('paused');
    }
  };

  const resumeListener = (data?: { monitoringId?: number; resumePrompt?: string }) => {
    if (pauseState.paused) {
      // Store monitoringId and resumePrompt - runner will use these for resume
      pauseState.monitoringId = data?.monitoringId;
      pauseState.resumePrompt = data?.resumePrompt;

      // DEBUG
      debug(`[DEBUG workflow] resumeListener received: monitoringId=${data?.monitoringId}, resumePrompt="${data?.resumePrompt}"`);

      pauseState.paused = false;
      emitter.setWorkflowStatus('running');
      if (pauseState.resolver) {
        pauseState.resolver();
        pauseState.resolver = null;
      }
    }
  };

  process.on('workflow:pause', pauseListener);
  process.on('workflow:resume', resumeListener);

  // Helper to reset pause state when chained handlers take over
  const resetPauseForChained = () => {
    if (pauseState.paused) {
      pauseState.paused = false;
      pauseState.requested = false;
      emitter.setWorkflowStatus('running');
    }
  };

  // Chained prompts event listeners
  const chainedCustomListener = (data: { prompt: string }) => {
    if (chainedState.active) {
      // If pause was triggered during chained wait, clear it since chained is handling the input
      resetPauseForChained();
      chainedState.pendingAction = { type: 'custom', prompt: data.prompt };
      if (chainedState.resolver) {
        chainedState.resolver();
        chainedState.resolver = null;
      }
    }
  };

  const chainedNextListener = () => {
    if (chainedState.active) {
      // If pause was triggered during chained wait, clear it since chained is handling the input
      resetPauseForChained();
      chainedState.pendingAction = { type: 'next' };
      if (chainedState.resolver) {
        chainedState.resolver();
        chainedState.resolver = null;
      }
    }
  };

  const chainedSkipListener = () => {
    if (chainedState.active) {
      // If pause was triggered during chained wait, clear it since chained is handling the input
      resetPauseForChained();
      chainedState.pendingAction = { type: 'skip' };
      if (chainedState.resolver) {
        chainedState.resolver();
        chainedState.resolver = null;
      }
    }
  };

  process.on('chained:custom', chainedCustomListener);
  process.on('chained:next', chainedNextListener);
  process.on('chained:skip-all', chainedSkipListener);

  try {
    for (let index = startIndex; index < template.steps.length; index += 1) {
    // Check if workflow should stop (Ctrl+C pressed)
    if (workflowShouldStop) {
      console.log(formatAgentLog('workflow', 'Workflow stopped by user.'));
      break;
    }

    // Check if workflow is paused - wait until resumed
    if (pauseState.paused) {
      pauseState.stepIndex = index;
      await new Promise<void>((resolve) => {
        pauseState.resolver = resolve;
      });
    }

    // Determine if this step should resume (we have monitoringId from the hook)
    const shouldResumeStep = pauseState.stepIndex === index && pauseState.monitoringId !== undefined;
    const stepResumeMonitoringId = shouldResumeStep ? pauseState.monitoringId : undefined;
    const stepResumePrompt = shouldResumeStep ? pauseState.resumePrompt : undefined;

    // DEBUG
    debug(`[DEBUG workflow] shouldResumeStep=${shouldResumeStep}, stepResumePrompt="${stepResumePrompt}", pauseState.resumePrompt="${pauseState.resumePrompt}"`);

    // Reset pause state after using it
    if (shouldResumeStep) {
      pauseState.stepIndex = null;
      pauseState.monitoringId = undefined;
      pauseState.resumePrompt = undefined;
      pauseState.requested = false;
    }

    const step = template.steps[index];

    // UI elements are pre-populated and don't need execution
    if (step.type === 'ui') {
      continue;
    }

    if (step.type !== 'module') {
      continue;
    }

    // Create unique agent ID for this step instance (matches UI pre-population)
    const uniqueAgentId = `${step.agentId}-step-${index}`;

    const skipResult = shouldSkipStep(step, index, completedSteps, activeLoop, ui, uniqueAgentId, emitter, selectedTrack, selectedConditions);
    if (skipResult.skip) {
      ui.logMessage(uniqueAgentId, skipResult.reason!);
      emitter.logMessage(uniqueAgentId, skipResult.reason!);
      continue;
    }

    logSkipDebug(step, activeLoop);

    // Update UI status to running (this clears the output buffer)
    ui.updateAgentStatus(uniqueAgentId, 'running');
    emitter.updateAgentStatus(uniqueAgentId, 'running');

    // Log start message AFTER clearing buffer
    ui.logMessage(uniqueAgentId, '═'.repeat(80));
    ui.logMessage(uniqueAgentId, `${step.agentName} started to work.`);
    emitter.logMessage(uniqueAgentId, '═'.repeat(80));
    emitter.logMessage(uniqueAgentId, `${step.agentName} started to work.`);

    // Reset behavior file to default "continue" before each agent run
    const behaviorFile = path.join(cwd, '.codemachine/memory/behavior.json');
    const behaviorDir = path.dirname(behaviorFile);
    if (!fs.existsSync(behaviorDir)) {
      fs.mkdirSync(behaviorDir, { recursive: true });
    }
    fs.writeFileSync(behaviorFile, JSON.stringify({ action: 'continue' }, null, 2));

    // Mark step as started (adds to notCompletedSteps)
    await markStepStarted(cmRoot, index);

    // Determine engine: step override > first authenticated engine
    let engineType: string;
    if (step.engine) {
      engineType = step.engine;

      // If an override is provided but not authenticated, log and fall back
      const overrideEngine = registry.get(engineType);
      const isOverrideAuthed = overrideEngine
        ? await authCache.isAuthenticated(overrideEngine.metadata.id, () => overrideEngine.auth.isAuthenticated())
        : false;
      if (!isOverrideAuthed) {
        const pretty = overrideEngine?.metadata.name ?? engineType;
        const authMsg = `${pretty} override is not authenticated; falling back to first authenticated engine by order. Run 'codemachine auth login' to use ${pretty}.`;
        ui.logMessage(uniqueAgentId, authMsg);
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
          ui.logMessage(uniqueAgentId, fallbackMsg);
          emitter.logMessage(uniqueAgentId, fallbackMsg);
        }
      }
    } else {
      // Fallback: find first authenticated engine by order (with caching)
      const engines = registry.getAll();
      let foundEngine = null;

      for (const engine of engines) {
        const isAuth = await authCache.isAuthenticated(
          engine.metadata.id,
          () => engine.auth.isAuthenticated()
        );
        if (isAuth) {
          foundEngine = engine;
          break;
        }
      }

      if (!foundEngine) {
        // If no authenticated engine, use default (first by order)
        foundEngine = registry.getDefault();
      }

      if (!foundEngine) {
        throw new Error('No engines registered. Please install at least one engine.');
      }

      engineType = foundEngine.metadata.id;
      const engineMsg = `No engine specified, using ${foundEngine.metadata.name} (${engineType})`;
      ui.logMessage(uniqueAgentId, engineMsg);
      emitter.logMessage(uniqueAgentId, engineMsg);
    }

    // Ensure the selected engine is used during execution
    // (executeStep falls back to default engine if step.engine is unset)
    // Mutate current step to carry the chosen engine forward
    step.engine = engineType;

    // Resolve model: step override > engine default, and update UI
    const engineModule = registry.get(engineType);
    const resolvedModel = step.model ?? engineModule?.metadata.defaultModel;
    if (resolvedModel) {
      emitter.updateAgentModel(uniqueAgentId, resolvedModel);
    }

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
      ui.logMessage(uniqueAgentId, '⏭️  Skip requested by user...');
      emitter.logMessage(uniqueAgentId, '⏭️  Skip requested by user...');
      abortController.abort();
    };
    process.once('workflow:skip', skipListener);

    try {
      // Check if fallback should be executed before the original step
      if (shouldExecuteFallback(step, index, notCompletedSteps)) {
        ui.logMessage(uniqueAgentId, `Detected incomplete step. Running fallback agent first.`);
        emitter.logMessage(uniqueAgentId, `Detected incomplete step. Running fallback agent first.`);
        try {
          await executeFallbackStep(step, cwd, workflowStartTime, engineType, ui, emitter, uniqueAgentId, abortController.signal);
        } catch (error) {
          // Fallback failed, step remains in notCompletedSteps
          ui.logMessage(uniqueAgentId, `Fallback failed. Skipping original step retry.`);
          emitter.logMessage(uniqueAgentId, `Fallback failed. Skipping original step retry.`);
          // Don't update status to failed - just let it stay as running or retrying
          throw error;
        }
      }

      // Log if resuming
      if (stepResumeMonitoringId) {
        ui.logMessage(uniqueAgentId, `Resuming from paused session...`);
        emitter.logMessage(uniqueAgentId, `Resuming from paused session...`);
      }

      let stepOutput = await executeStep(step, cwd, {
        logger: () => {}, // No-op: UI reads from log files
        stderrLogger: () => {}, // No-op: UI reads from log files
        ui,
        emitter,
        abortSignal: abortController.signal,
        uniqueAgentId,
        resumeMonitoringId: stepResumeMonitoringId,
        resumePrompt: stepResumePrompt,
      });

      // If we resumed from pause with a custom prompt, enter steering loop
      // This lets the user keep sending prompts until they press Enter with empty input
      if (stepResumePrompt && stepResumeMonitoringId) {
        let steeringMonitoringId = stepOutput.monitoringId;
        let continueSteeringLoop = true;

        // Keep agent status as "running" while in steering loop
        // (executeStep may have marked it complete, but we're not done yet)
        ui.updateAgentStatus(uniqueAgentId, 'running');
        emitter.updateAgentStatus(uniqueAgentId, 'running');

        while (continueSteeringLoop) {
          // Set paused state to show prompt UI (reuse the pause UI for steering)
          pauseState.paused = true;
          emitter.setWorkflowStatus('paused');

          // Wait for user input via workflow:resume event
          await new Promise<void>((resolve) => {
            pauseState.resolver = resolve;
          });

          // Get the resume prompt from pause state
          const steeringPrompt = pauseState.resumePrompt;
          const newMonitoringId = pauseState.monitoringId;

          // Clear pause state
          pauseState.paused = false;
          pauseState.resumePrompt = undefined;
          pauseState.monitoringId = undefined;

          // If empty prompt, user wants to proceed to next step
          if (!steeringPrompt) {
            emitter.setWorkflowStatus('running');
            continueSteeringLoop = false;
            break;
          }

          // User sent another prompt - log it and resume
          const userInputLog = formatUserInput(steeringPrompt);
          ui.logMessage(uniqueAgentId, userInputLog);
          emitter.logMessage(uniqueAgentId, userInputLog);

          // Write to agent log file
          if (steeringMonitoringId !== undefined) {
            const loggerService = AgentLoggerService.getInstance();
            loggerService.write(steeringMonitoringId, `\n${userInputLog}\n`);
          }

          // Set status back to running
          ui.updateAgentStatus(uniqueAgentId, 'running');
          emitter.updateAgentStatus(uniqueAgentId, 'running');
          emitter.setWorkflowStatus('running');

          // Resume with the new prompt
          stepOutput = await executeStep(step, cwd, {
            logger: () => {},
            stderrLogger: () => {},
            ui,
            emitter,
            abortSignal: abortController.signal,
            uniqueAgentId,
            resumeMonitoringId: newMonitoringId ?? steeringMonitoringId,
            resumePrompt: steeringPrompt,
          });

          // Update monitoring ID for next iteration
          steeringMonitoringId = stepOutput.monitoringId;
        }
      }

      // Handle chained prompts if present (allows steering the agent with additional prompts)
      if (stepOutput.chainedPrompts && stepOutput.chainedPrompts.length > 0) {
        chainedState.active = true;
        chainedState.prompts = stepOutput.chainedPrompts;
        chainedState.currentIndex = 0;
        chainedState.monitoringId = stepOutput.monitoringId;

        // Show modal with initial state
        const getNextLabel = () => {
          if (chainedState.currentIndex < chainedState.prompts.length) {
            return chainedState.prompts[chainedState.currentIndex].label;
          }
          return null;
        };

        emitter.setChainedState({
          active: true,
          currentIndex: chainedState.currentIndex,
          totalPrompts: chainedState.prompts.length,
          nextPromptLabel: getNextLabel(),
          monitoringId: chainedState.monitoringId,
        });

        // Loop until user chooses to skip or all prompts exhausted and they choose next
        while (chainedState.active) {
          // Wait for user action
          await new Promise<void>((resolve) => {
            chainedState.resolver = resolve;
          });

          const action = chainedState.pendingAction;
          chainedState.pendingAction = null;

          if (!action) continue;

          if (action.type === 'skip') {
            // User chose to skip all remaining chained prompts
            ui.logMessage(uniqueAgentId, `Skipping remaining chained prompts.`);
            emitter.logMessage(uniqueAgentId, `Skipping remaining chained prompts.`);
            chainedState.active = false;
            break;
          }

          if (action.type === 'next') {
            // Check if there are more prompts in queue
            if (chainedState.currentIndex >= chainedState.prompts.length) {
              // No more prompts - continue to next agent
              ui.logMessage(uniqueAgentId, `All chained prompts completed. Continuing to next agent.`);
              emitter.logMessage(uniqueAgentId, `All chained prompts completed. Continuing to next agent.`);
              chainedState.active = false;
              break;
            }

            // Feed the next chained prompt
            const nextPrompt = chainedState.prompts[chainedState.currentIndex];
            ui.logMessage(uniqueAgentId, `Feeding chained prompt: "${nextPrompt.label}"`);
            emitter.logMessage(uniqueAgentId, `Feeding chained prompt: "${nextPrompt.label}"`);

            // Set status back to running so UI continues showing this agent
            ui.updateAgentStatus(uniqueAgentId, 'running');
            emitter.updateAgentStatus(uniqueAgentId, 'running');

            // Resume with chained prompt content
            stepOutput = await executeStep(step, cwd, {
              logger: () => {},
              stderrLogger: () => {},
              ui,
              emitter,
              abortSignal: abortController.signal,
              uniqueAgentId,
              resumeMonitoringId: chainedState.monitoringId,
              resumePrompt: nextPrompt.content,
            });

            // Update monitoring ID for next iteration
            chainedState.monitoringId = stepOutput.monitoringId;
            chainedState.currentIndex += 1;

            // Update modal state
            emitter.setChainedState({
              active: true,
              currentIndex: chainedState.currentIndex,
              totalPrompts: chainedState.prompts.length,
              nextPromptLabel: getNextLabel(),
              monitoringId: chainedState.monitoringId,
            });
          }

          if (action.type === 'custom' && action.prompt) {
            // User typed a custom prompt - format with user input style
            const userInputLog = formatUserInput(action.prompt);
            ui.logMessage(uniqueAgentId, userInputLog);
            emitter.logMessage(uniqueAgentId, userInputLog);

            // Write to agent log file directly
            if (chainedState.monitoringId !== undefined) {
              const loggerService = AgentLoggerService.getInstance();
              loggerService.write(chainedState.monitoringId, `\n${userInputLog}\n`);
            }

            // Set status back to running so UI continues showing this agent
            ui.updateAgentStatus(uniqueAgentId, 'running');
            emitter.updateAgentStatus(uniqueAgentId, 'running');

            // Resume with user's custom prompt
            stepOutput = await executeStep(step, cwd, {
              logger: () => {},
              stderrLogger: () => {},
              ui,
              emitter,
              abortSignal: abortController.signal,
              uniqueAgentId,
              resumeMonitoringId: chainedState.monitoringId,
              resumePrompt: action.prompt,
            });

            // Update monitoring ID for next iteration
            chainedState.monitoringId = stepOutput.monitoringId;

            // Show modal again (same state - custom prompts don't advance the queue)
            emitter.setChainedState({
              active: true,
              currentIndex: chainedState.currentIndex,
              totalPrompts: chainedState.prompts.length,
              nextPromptLabel: getNextLabel(),
              monitoringId: chainedState.monitoringId,
            });
          }
        }

        // Clear chained state
        chainedState.active = false;
        chainedState.prompts = [];
        chainedState.currentIndex = 0;
        chainedState.monitoringId = undefined;
        emitter.setChainedState(null);
      }

      // Check for trigger behavior first
      const triggerResult = await handleTriggerLogic(step, stepOutput.output, cwd, ui, emitter);
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
            ui,
            emitter,
            abortSignal: abortController.signal,
          });
        } catch (triggerError) {
          // Check if this was a user-requested skip (abort)
          if (triggerError instanceof Error && triggerError.name === 'AbortError') {
            ui.updateAgentStatus(triggeredAgentId, 'skipped');
            emitter.updateAgentStatus(triggeredAgentId, 'skipped');
            ui.logMessage(triggeredAgentId, `Triggered agent was skipped by user.`);
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
      ui.updateAgentStatus(uniqueAgentId, 'completed');
      emitter.updateAgentStatus(uniqueAgentId, 'completed');

      // Log completion messages BEFORE loop check (so they're part of current agent's output)
      ui.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
      ui.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
      emitter.logMessage(uniqueAgentId, `${step.agentName} has completed their work.`);
      emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');

      // Check for checkpoint behavior first (to pause workflow for manual review)
      const checkpointResult = await handleCheckpointLogic(step, stepOutput.output, cwd, ui, emitter);
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
        ui.clearCheckpointState();
        emitter.clearCheckpointState();

        if (workflowShouldStop) {
          // User chose to quit from checkpoint - set status to stopped
          ui.setWorkflowStatus('stopped');
          emitter.setWorkflowStatus('stopped');
          break; // User chose to quit
        }
        // Otherwise continue to next step (current step already marked complete via executeOnce)
      }

      const loopResult = await handleLoopLogic(step, index, stepOutput.output, loopCounters, cwd, ui, emitter);

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
        ui.setLoopState(loopState);
        emitter.setLoopState(loopState);

        // Reset all agents that will be re-executed in the loop
        // Clear their UI data (telemetry, tool counts, subagents) and monitoring registry data
        // Save their current state to execution history with cycle number
        for (let resetIndex = loopResult.newIndex; resetIndex <= index; resetIndex += 1) {
          const resetStep = template.steps[resetIndex];
          if (resetStep && resetStep.type === 'module') {
            const resetUniqueAgentId = `${resetStep.agentId}-step-${resetIndex}`;
            await ui.resetAgentForLoop(resetUniqueAgentId, iteration);
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
          ui.setLoopState(null);
          ui.clearLoopRound(uniqueAgentId);
          emitter.setLoopState(null);
          emitter.clearLoopRound(uniqueAgentId);
        }
      }
    } catch (error) {
      // Check if this was a pause request (process killed)
      if (pauseState.requested) {
        ui.logMessage(uniqueAgentId, `${step.agentName} paused.`);
        emitter.logMessage(uniqueAgentId, `${step.agentName} paused.`);

        // Store step index for resume - loop will re-run this step
        pauseState.stepIndex = index;

        // Reset the requested flag now that we've handled it
        pauseState.requested = false;

        // Wait for resume
        await new Promise<void>((resolve) => {
          pauseState.resolver = resolve;
        });

        // Re-run this step by not incrementing index (continue skips the for-loop increment)
        index -= 1;
      } else if (error instanceof Error && error.name === 'AbortError') {
        // Check if this was a user-requested skip (abort)
        ui.updateAgentStatus(uniqueAgentId, 'skipped');
        emitter.updateAgentStatus(uniqueAgentId, 'skipped');
        ui.logMessage(uniqueAgentId, `${step.agentName} was skipped by user.`);
        ui.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
        emitter.logMessage(uniqueAgentId, `${step.agentName} was skipped by user.`);
        emitter.logMessage(uniqueAgentId, '\n' + '═'.repeat(80) + '\n');
        // Continue to next step - don't throw
      } else {
        // Don't update status to failed - let it stay as running/retrying
        const failMsg = `${step.agentName} failed: ${error instanceof Error ? error.message : String(error)}`;
        ui.logMessage(uniqueAgentId, failMsg);
        emitter.logMessage(uniqueAgentId, failMsg);
        throw error;
      }
    } finally {
      // Always clean up the skip listener
      process.removeListener('workflow:skip', skipListener);
    }
  }

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
  ui.setWorkflowStatus('completed');
  emitter.setWorkflowStatus('completed');
  // UI will stay running - user presses Ctrl+C to exit with two-stage behavior
  // Wait indefinitely - the SIGINT handler will call process.exit()
  await new Promise(() => {
    // Never resolves - keeps event loop alive until Ctrl+C exits process
  });
  } catch (error) {
    // On workflow error, set status, stop UI, then exit
    ui.setWorkflowStatus('stopped');
    emitter.setWorkflowStatus('stopped');

    // Stop UI to restore console before logging error
    ui.stop();

    // Re-throw error to be handled by caller (will now print after UI is stopped)
    throw error;
  } finally {
    // Clean up workflow listeners
    process.removeListener('workflow:stop', stopListener);
    process.removeListener('workflow:pause', pauseListener);
    process.removeListener('workflow:resume', resumeListener);
    process.removeListener('chained:custom', chainedCustomListener);
    process.removeListener('chained:next', chainedNextListener);
    process.removeListener('chained:skip-all', chainedSkipListener);
  }
}
