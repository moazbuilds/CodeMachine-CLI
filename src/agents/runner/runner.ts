import type { EngineType } from '../../infra/engines/index.js';
import { getEngine } from '../../infra/engines/index.js';
import { loadAgentConfig } from './config.js';
import { loadChainedPrompts, type ChainedPrompt } from './chained.js';
import { AgentMonitorService, AgentLoggerService, StatusService } from '../monitoring/index.js';

export type { ChainedPrompt } from './chained.js';
import type { ParsedTelemetry } from '../../infra/engines/core/types.js';
import { formatForLogFile } from '../../shared/formatters/logFileFormatter.js';
import { renderToChalk } from '../../shared/formatters/outputMarkers.js';
import { info, error, debug } from '../../shared/logging/logger.js';
import { STEP_RESUME_DEFAULT } from '../../shared/prompts/injected.js';

/**
 * Cache for engine authentication status with TTL (shared across all subagents)
 * Prevents repeated auth checks that can take 10-30 seconds each
 * CRITICAL: This fixes the 5-minute delay bug when spawning multiple subagents
 */
class EngineAuthCache {
  private cache: Map<string, { isAuthenticated: boolean; timestamp: number }> = new Map();
  private ttlMs: number = 5 * 60 * 1000; // 5 minutes TTL

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
}

// Global auth cache instance (shared across all subagent executions)
const authCache = new EngineAuthCache();

/**
 * Minimal UI interface for agent execution
 */
export interface AgentExecutionUI {
  registerMonitoringId(uiAgentId: string, monitoringAgentId: number): void;
}

export interface ExecuteAgentOptions {
  /**
   * Engine to use (overrides agent config)
   */
  engine?: EngineType;

  /**
   * Model to use (overrides agent config)
   */
  model?: string;

  /**
   * Working directory for execution
   */
  workingDir: string;

  /**
   * Project root for config lookup (defaults to workingDir)
   */
  projectRoot?: string;

  /**
   * Logger for stdout
   */
  logger?: (chunk: string) => void;

  /**
   * Logger for stderr
   */
  stderrLogger?: (chunk: string) => void;

  /**
   * Telemetry callback (for UI updates)
   */
  onTelemetry?: (telemetry: ParsedTelemetry) => void;

  /**
   * Abort signal
   */
  abortSignal?: AbortSignal;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Parent agent ID (for tracking parent-child relationships)
   */
  parentId?: number;

  /**
   * Disable monitoring (for special cases where monitoring is not desired)
   */
  disableMonitoring?: boolean;

  /**
   * UI manager (for registering monitoring IDs)
   */
  ui?: AgentExecutionUI;

  /**
   * Unique agent ID for UI (for registering monitoring IDs)
   */
  uniqueAgentId?: string;

  /**
   * Display prompt (for logging/monitoring - shows user's actual request)
   * If not provided, uses the full execution prompt
   */
  displayPrompt?: string;

  /**
   * Monitoring ID for resuming (skip new registration, use existing log)
   */
  resumeMonitoringId?: number;

  /**
   * Custom prompt for resume (instead of "Continue from where you left off")
   */
  resumePrompt?: string;

  /**
   * Session ID for resuming (direct, for when monitoringId is not available)
   */
  resumeSessionId?: string;

  /**
   * Selected conditions for filtering conditional chained prompt paths
   */
  selectedConditions?: string[];

  /**
   * Skip writing to agent's log file (caller handles logging externally)
   */
  skipLogFile?: boolean;
}

/**
 * Ensures the engine is authenticated
 */
async function ensureEngineAuth(engineType: EngineType): Promise<void> {
  const { registry } = await import('../../infra/engines/index.js');
  const engine = registry.get(engineType);

  if (!engine) {
    const availableEngines = registry.getAllIds().join(', ');
    throw new Error(
      `Unknown engine type: ${engineType}. Available engines: ${availableEngines}`
    );
  }

  const isAuthed = await engine.auth.isAuthenticated();
  if (!isAuthed) {
    console.error(`\n${engine.metadata.name} authentication required`);
    console.error(`\nRun the following command to authenticate:\n`);
    console.error(`  codemachine auth login\n`);
    throw new Error(`${engine.metadata.name} authentication required`);
  }
}

/**
 * Executes a sub-agent or CLI agent with a pre-built prompt
 *
 * This is a low-level execution function that:
 * - Accepts FINAL, ready-to-use prompts (no template loading or prompt building)
 * - Handles engine authentication
 * - Manages monitoring and logging
 * - Executes the engine
 * - Stores output in memory
 *
 * Prompt building is the caller's responsibility:
 * - Orchestration layer: builds [SYSTEM] + [INPUT FILES] + [REQUEST]
 * - Workflow layer: processes templates with processPromptString()
 *
 * This loads agent configuration from:
 * - config/sub.agents.js
 * - config/main.agents.js
 * - .codemachine/agents/agents-config.json
 *
 * Used by:
 * - Orchestration executor (src/agents/orchestration/executor.ts)
 * - Workflow step executor (src/workflows/execution/step.ts)
 * - CLI commands (via orchestration)
 */
export interface AgentExecutionOutput {
  output: string;
  agentId?: number;
  chainedPrompts?: ChainedPrompt[];
}

export async function executeAgent(
  agentId: string,
  prompt: string,
  options: ExecuteAgentOptions,
): Promise<AgentExecutionOutput> {
  const { workingDir, projectRoot, engine: engineOverride, model: modelOverride, logger, stderrLogger, onTelemetry, abortSignal, timeout, parentId, disableMonitoring, ui, uniqueAgentId, displayPrompt, resumeMonitoringId, resumePrompt, resumeSessionId: resumeSessionIdOption, selectedConditions } = options;

  debug(`[AgentRunner] executeAgent called: agentId=%s promptLength=%d`, agentId, prompt.length);
  debug(`[AgentRunner] Options: workingDir=%s engineOverride=%s modelOverride=%s parentId=%s`,
    workingDir, engineOverride ?? '(none)', modelOverride ?? '(none)', parentId ?? '(none)');
  debug(`[AgentRunner] Resume options: resumeMonitoringId=%s resumeSessionId=%s resumePrompt=%s`,
    resumeMonitoringId ?? '(none)', resumeSessionIdOption ?? '(none)', resumePrompt ? resumePrompt.slice(0, 50) + '...' : '(none)');

  // If resuming, use direct sessionId or look up from monitor
  let resumeSessionId: string | undefined = resumeSessionIdOption;
  if (!resumeSessionId && resumeMonitoringId !== undefined) {
    const monitor = AgentMonitorService.getInstance();
    const resumeAgent = monitor.getAgent(resumeMonitoringId);
    debug(`[AgentRunner] Looking up sessionId from monitoringId=%d, found agent=%s`,
      resumeMonitoringId, resumeAgent ? 'yes' : 'no');
    if (resumeAgent?.sessionId) {
      resumeSessionId = resumeAgent.sessionId;
      debug(`[AgentRunner] Using sessionId %s from monitoringId %d`, resumeSessionId, resumeMonitoringId);
    }
  }
  if (resumeSessionId) {
    debug(`[AgentRunner] Will resume with sessionId: %s`, resumeSessionId);
  }

  // Load agent config to determine engine and model
  const agentConfig = await loadAgentConfig(agentId, projectRoot ?? workingDir);

  // Determine engine: CLI override > agent config > first authenticated engine
  const { registry } = await import('../../infra/engines/index.js');
  let engineType: EngineType;

  if (engineOverride) {
    engineType = engineOverride;
  } else if (agentConfig.engine) {
    engineType = agentConfig.engine;
  } else {
    // Fallback: find first authenticated engine by order (WITH CACHING - critical for subagents)
    const engines = registry.getAll();
    let foundEngine = null;

    for (const engine of engines) {
      // Use cached auth check to avoid 10-30 second delays per subagent
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
    info(`No engine specified for agent '${agentId}', using ${foundEngine.metadata.name} (${engineType})`);
  }

  // Ensure authentication
  await ensureEngineAuth(engineType);

  // Get engine module for defaults
  const engineModule = registry.get(engineType);
  if (!engineModule) {
    throw new Error(`Engine not found: ${engineType}`);
  }

  // Model resolution: CLI override > agent config (legacy) > engine default
  const model = modelOverride ?? (agentConfig.model as string | undefined) ?? engineModule.metadata.defaultModel;
  const modelReasoningEffort = (agentConfig.modelReasoningEffort as 'low' | 'medium' | 'high' | undefined) ?? engineModule.metadata.defaultModelReasoningEffort;

  // Initialize monitoring with engine/model info (unless explicitly disabled)
  const monitor = !disableMonitoring ? AgentMonitorService.getInstance() : null;
  const loggerService = !disableMonitoring ? AgentLoggerService.getInstance() : null;
  const status = !disableMonitoring ? StatusService.getInstance() : null;
  let monitoringAgentId: number | undefined;

  if (monitor && loggerService) {
    // Check if resumeMonitoringId is valid (agent still exists in DB)
    const resumeAgentExists = resumeMonitoringId !== undefined && monitor.getAgent(resumeMonitoringId) !== undefined;

    if (resumeMonitoringId !== undefined && resumeAgentExists) {
      // RESUME: Use existing monitoring entry (skip registration, use existing log file)
      monitoringAgentId = resumeMonitoringId;
      debug(`[AgentRunner] RESUME: Using existing monitoringId=%d, skipping registration`, monitoringAgentId);

      // Register ID mapping and mark as running (DB + UI)
      if (status && uniqueAgentId) {
        status.register(monitoringAgentId, uniqueAgentId);
        await status.run(monitoringAgentId);
        debug(`[AgentRunner] RESUME: Marked agent as running via StatusService`);
      } else {
        // Fallback: no uniqueAgentId, use monitor directly
        await monitor.markRunning(monitoringAgentId);
        debug(`[AgentRunner] RESUME: Marked agent as running (no uniqueAgentId)`);
      }

      // Register monitoring ID with UI so it can load existing logs
      if (ui && uniqueAgentId) {
        debug(`[AgentRunner] RESUME: Registering monitoringId=%d with UI (uniqueAgentId=%s)`, monitoringAgentId, uniqueAgentId);
        ui.registerMonitoringId(uniqueAgentId, monitoringAgentId);
      }
    } else {
      if (resumeMonitoringId !== undefined && !resumeAgentExists) {
        debug(`[AgentRunner] RESUME: monitoringId=%d no longer exists in DB, will register new agent`, resumeMonitoringId);
      }
      // NEW EXECUTION: Register new monitoring entry
      const promptForDisplay = displayPrompt || prompt;
      debug(`[AgentRunner] NEW: Registering new monitoring entry for agentId=%s`, agentId);
      monitoringAgentId = await monitor.register({
        name: agentId,
        prompt: promptForDisplay, // This gets truncated in monitor for memory efficiency
        parentId,
        engine: engineType,
        engineProvider: engineType,
        modelName: model,
      });
      debug(`[AgentRunner] NEW: Registered with monitoringId=%d`, monitoringAgentId);

      // Register ID mapping for status coordination
      if (status && uniqueAgentId) {
        status.register(monitoringAgentId, uniqueAgentId);
      }

      // Store FULL prompt for debug mode logging (not the display prompt)
      // In debug mode, we want to see the complete composite prompt with template + input files
      loggerService.storeFullPrompt(monitoringAgentId, prompt);

      // Register monitoring ID with UI immediately so it can load logs
      if (ui && uniqueAgentId && monitoringAgentId !== undefined) {
        debug(`[AgentRunner] NEW: Registering monitoringId=%d with UI (uniqueAgentId=%s)`, monitoringAgentId, uniqueAgentId);
        ui.registerMonitoringId(uniqueAgentId, monitoringAgentId);
      }
    }
  }

  // Get engine and execute
  // NOTE: Prompt is already complete - no template loading or building here
  const engine = getEngine(engineType);
  debug(`[AgentRunner] Starting engine execution: engine=%s model=%s resumeSessionId=%s`,
    engineType, model, resumeSessionId ?? '(new session)');

  let totalStdout = '';

  try {
    const result = await engine.run({
      prompt, // Already complete and ready to use
      workingDir,
      resumeSessionId,
      resumePrompt: resumeSessionId ? (resumePrompt || STEP_RESUME_DEFAULT) : undefined,
      model,
      modelReasoningEffort,
      env: {
        ...process.env,
        // Pass parent agent ID to child processes (for orchestration context)
        ...(monitoringAgentId !== undefined && {
          CODEMACHINE_PARENT_AGENT_ID: monitoringAgentId.toString()
        })
      },
      onData: (chunk) => {
        totalStdout += chunk;

        // Dual-stream: write to log file (with status text) AND original logger (with colors)
        if (loggerService && monitoringAgentId !== undefined) {
          // Transform color markers to status text for log file readability
          const logChunk = formatForLogFile(chunk);
          loggerService.write(monitoringAgentId, logChunk);
        }

        // Keep original format with color markers for UI display
        if (logger) {
          logger(chunk);
        } else {
          try {
            // Convert markers to chalk colors for direct console output
            process.stdout.write(renderToChalk(chunk));
          } catch {
            // ignore streaming failures
          }
        }
      },
      onErrorData: (chunk) => {
        // Also log stderr to file (with status text transformation)
        if (loggerService && monitoringAgentId !== undefined) {
          const logChunk = formatForLogFile(chunk);
          loggerService.write(monitoringAgentId, `[STDERR] ${logChunk}`);
        }

        if (stderrLogger) {
          stderrLogger(chunk);
        } else {
          try {
            process.stderr.write(chunk);
          } catch {
            // ignore streaming failures
          }
        }
      },
      onTelemetry: (telemetry) => {
        // Update telemetry in monitoring (fire and forget - don't block streaming)
        if (monitor && monitoringAgentId !== undefined) {
          monitor.updateTelemetry(monitoringAgentId, telemetry).catch(err =>
            error(`Failed to update telemetry: ${err}`)
          );
        }

        // Forward to caller's telemetry callback (for UI updates)
        if (onTelemetry) {
          onTelemetry(telemetry);
        }
      },
      onSessionId: (sessionId) => {
        // Store session ID for resume capability
        debug(`[onSessionId callback] sessionId=${sessionId}, monitor=${!!monitor}, monitoringAgentId=${monitoringAgentId}`);
        if (monitor && monitoringAgentId !== undefined) {
          monitor.setSessionId(monitoringAgentId, sessionId).catch(err =>
            error(`Failed to set session ID: ${err}`)
          );
        }
      },
      abortSignal,
      timeout,
    });

    const stdout = totalStdout || result.stdout;

    debug(`[AgentRunner] Engine execution completed, outputLength=%d`, totalStdout.length);

    // Determine if this is a resume (conversational loop) vs fresh execution
    const isResume = resumeSessionId !== undefined;

    // Mark agent as completed (only for fresh execution, not resume)
    // During resume, the agent stays in running/awaiting state for continued conversation
    if (!isResume && monitoringAgentId !== undefined) {
      debug(`[AgentRunner] Marking agent %d as completed`, monitoringAgentId);
      if (status) {
        await status.complete(monitoringAgentId);
      } else if (monitor) {
        await monitor.complete(monitoringAgentId);
      }
      // Note: Don't close stream here - workflow may write more messages
      // Streams will be closed by cleanup handlers or monitoring service shutdown
    } else if (isResume) {
      debug(`[AgentRunner] Resume mode - agent %d stays running for continued conversation`, monitoringAgentId ?? -1);
    }

    // Load chained prompts if configured
    // Always load - the workflow runner decides whether to use them based on promptQueue state
    let chainedPrompts: ChainedPrompt[] | undefined;
    debug(`[AgentRunner] ChainedPrompts path: %s`, agentConfig.chainedPromptsPath ?? '(none)');
    if (agentConfig.chainedPromptsPath) {
      chainedPrompts = await loadChainedPrompts(
        agentConfig.chainedPromptsPath,
        projectRoot ?? workingDir,
        selectedConditions ?? []
      );
      debug(`[ChainedPrompts] Loaded ${chainedPrompts.length} chained prompts for agent '${agentId}'`);
    } else {
      debug(`[ChainedPrompts] No chainedPromptsPath for agent '${agentId}'`);
    }

    debug(`[AgentRunner] Returning result: monitoringAgentId=%d chainedPrompts=%d`,
      monitoringAgentId ?? -1, chainedPrompts?.length ?? 0);

    return {
      output: stdout,
      agentId: monitoringAgentId,
      chainedPrompts,
    };
  } catch (err) {
    debug(`[AgentRunner] Error during execution: %s`, (err as Error).message);

    // Mark agent status based on resumability (delegates to StatusService)
    if (monitoringAgentId !== undefined && status) {
      await status.handleAbort(monitoringAgentId, err as Error);
    }
    throw err;
  }
}
