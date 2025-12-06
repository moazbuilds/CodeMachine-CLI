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
  markStepCompleted,
  markStepStarted,
  removeFromNotCompleted,
  getResumeStartIndex,
} from '../../shared/workflows/index.js';
import { registry } from '../../infra/engines/index.js';
import { shouldSkipStep, logSkipDebug, type ActiveLoop } from '../behaviors/skip.js';
import { handleLoopLogic, createActiveLoop } from '../behaviors/loop/controller.js';
import { handleTriggerLogic } from '../behaviors/trigger/controller.js';
import { handleCheckpointLogic } from '../behaviors/checkpoint/controller.js';
import { executeStep } from './step.js';
import { executeTriggerAgent } from './trigger.js';
import { shouldExecuteFallback, executeFallbackStep } from './fallback.js';
import { WorkflowUIManager } from '../../ui/index.js';
import { MonitoringCleanup } from '../../agents/monitoring/index.js';
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
  const totalModuleSteps = template.steps.filter(s => s.type === 'module').length;
  emitter.workflowStarted(template.name, totalModuleSteps);

  // Pre-populate timeline with all workflow steps BEFORE starting UI
  // This prevents duplicate renders at startup
  // Set initial status based on completion tracking
  template.steps.forEach((step, stepIndex) => {
    if (step.type === 'module') {
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
        initialStatus
      );

      // Update agent with step information
      const state = ui.getState();
      const agent = state.agents.find(a => a.id === agentId);
      if (agent) {
        agent.stepIndex = stepIndex;
        agent.totalSteps = template.steps.filter(s => s.type === 'module').length;
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
  const stopListener = () => {
    workflowShouldStop = true;
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
  let currentAbortController: AbortController | null = null; // Separate - different lifecycle

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

    const skipResult = shouldSkipStep(step, index, completedSteps, activeLoop, ui, uniqueAgentId, emitter);
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

      const output = await executeStep(step, cwd, {
        logger: () => {}, // No-op: UI reads from log files
        stderrLogger: () => {}, // No-op: UI reads from log files
        ui,
        emitter,
        abortSignal: abortController.signal,
        uniqueAgentId,
        resumeMonitoringId: stepResumeMonitoringId,
        resumePrompt: stepResumePrompt,
      });

      // Check for trigger behavior first
      const triggerResult = await handleTriggerLogic(step, output, cwd, ui, emitter);
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
      const checkpointResult = await handleCheckpointLogic(step, output, cwd, ui, emitter);
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

      const loopResult = await handleLoopLogic(step, index, output, loopCounters, cwd, ui, emitter);

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
  MonitoringCleanup.clearWorkflowHandlers();

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
  }
}
