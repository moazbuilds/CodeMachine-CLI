import * as path from "node:path";
import * as fs from "node:fs";

import type { RunWorkflowOptions } from "../templates/index.js";
import { loadTemplateWithPath } from "../templates/index.js";
import { formatAgentLog } from "../../shared/logging/index.js";
import { debug, info, setDebugLogFile } from "../../shared/logging/logger.js";
import {
	getTemplatePathFromTracking,
	getCompletedSteps,
	getNotCompletedSteps,
	markStepCompleted,
	markStepStarted,
	removeFromNotCompleted,
	getResumeStartIndex,
} from "../../shared/workflows/index.js";
import { registry } from "../../infra/engines/index.js";
import {
	shouldSkipStep,
	logSkipDebug,
	type ActiveLoop,
} from "../behaviors/skip.js";
import {
	handleLoopLogic,
	createActiveLoop,
} from "../behaviors/loop/controller.js";
import { handleTriggerLogic } from "../behaviors/trigger/controller.js";
import { handleCheckpointLogic } from "../behaviors/checkpoint/controller.js";
import { executeStep } from "./step.js";
import { executeTriggerAgent } from "./trigger.js";
import { shouldExecuteFallback, executeFallbackStep } from "./fallback.js";
import { WorkflowUIManager } from "../../ui/index.js";
import { MonitoringCleanup } from "../../agents/monitoring/index.js";
import {
	type OpenCodeServer,
	startOpenCodeServer,
	attachToExternalServer,
	checkServerHealth,
} from "../../infra/engines/providers/opencode/execution/server.js";

/**
 * Cache for engine authentication status with TTL
 * Prevents repeated auth checks (which can take 10-30 seconds)
 */
class EngineAuthCache {
	private cache: Map<string, { isAuthenticated: boolean; timestamp: number }> =
		new Map();
	private ttlMs: number = 5 * 60 * 1000; // 5 minutes TTL

	/**
	 * Check if engine is authenticated (with caching)
	 */
	async isAuthenticated(
		engineId: string,
		checkFn: () => Promise<boolean>,
	): Promise<boolean> {
		const cached = this.cache.get(engineId);
		const now = Date.now();

		// Return cached value if still valid
		if (cached && now - cached.timestamp < this.ttlMs) {
			return cached.isAuthenticated;
		}

		// Cache miss or expired - perform actual check
		const result = await checkFn();

		// Cache the result
		this.cache.set(engineId, {
			isAuthenticated: result,
			timestamp: now,
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

export async function runWorkflow(
	options: RunWorkflowOptions = {},
): Promise<void> {
	const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

	// Redirect debug logs to file whenever LOG_LEVEL=debug (or DEBUG env is truthy) so they don't break Ink layout
	const rawLogLevel = (process.env.LOG_LEVEL || "").trim().toLowerCase();
	const debugFlag = (process.env.DEBUG || "").trim().toLowerCase();
	const debugEnabled =
		rawLogLevel === "debug" ||
		(debugFlag !== "" && debugFlag !== "0" && debugFlag !== "false");
	const isDebugLogLevel = debugEnabled;
	const debugLogPath = isDebugLogLevel
		? path.join(cwd, ".codemachine", "logs", "workflow-debug.log")
		: null;
	setDebugLogFile(debugLogPath);

	// Set up cleanup handlers for graceful shutdown
	MonitoringCleanup.setup();

	// Load template from .codemachine/template.json or use provided path
	const cmRoot = path.join(cwd, ".codemachine");
	const templatePath =
		options.templatePath || (await getTemplatePathFromTracking(cmRoot));

	const { template } = await loadTemplateWithPath(cwd, templatePath);

	debug(`Using workflow template: ${template.name}`);

	// Check for OpenCode server options (from CLI flags or environment variables)
	const useOpencodeServer =
		options.opencodeServer || process.env.CODEMACHINE_OPENCODE_SERVER === "1";
	const opencodeAttachUrl =
		options.opencodeAttach || process.env.CODEMACHINE_OPENCODE_ATTACH;

	// Detect if any steps use OpenCode engine
	const hasOpenCodeSteps = template.steps.some(
		(step) => step.type === "module" && step.engine === "opencode",
	);

	// Set up OpenCode server if requested and workflow has OpenCode steps
	let opencodeServer: OpenCodeServer | null = null;
	if (hasOpenCodeSteps && (useOpencodeServer || opencodeAttachUrl)) {
		if (opencodeAttachUrl) {
			// Attach to existing external server
			info(`Attaching to external OpenCode server: ${opencodeAttachUrl}`);
			opencodeServer = attachToExternalServer(opencodeAttachUrl);

			// Verify server is healthy
			const healthy = await checkServerHealth(opencodeAttachUrl);
			if (!healthy) {
				throw new Error(
					`Cannot connect to OpenCode server at ${opencodeAttachUrl}. Is it running?`,
				);
			}
			info(`Connected to OpenCode server at ${opencodeServer.url}`);
		} else if (useOpencodeServer) {
			// Start consolidated server (experimental)
			info(
				"[Experimental] Starting consolidated OpenCode server for workflow...",
			);
			try {
				opencodeServer = await startOpenCodeServer({ workingDir: cwd });
				info(`OpenCode server started at ${opencodeServer.url}`);
			} catch (err) {
				throw new Error(
					`Failed to start OpenCode server: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		// Inject attach URL into all OpenCode steps
		if (opencodeServer) {
			for (const step of template.steps) {
				if (step.type === "module" && step.engine === "opencode") {
					step.attach = opencodeServer.url;
				}
			}
		}
	}

	// Sync agent configurations before running the workflow
	const workflowAgents = Array.from(
		template.steps
			.filter((step) => step.type === "module")
			.reduce((acc, step) => {
				const id = step.agentId?.trim();
				if (!id) return acc;
				const existing = acc.get(id) ?? { id };
				acc.set(id, {
					...existing,
					id,
					model: step.model ?? existing.model,
					modelReasoningEffort:
						step.modelReasoningEffort ?? existing.modelReasoningEffort,
				});
				return acc;
			}, new Map<
				string,
				{ id: string; model?: unknown; modelReasoningEffort?: unknown }
			>())
			.values(),
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

	// Initialize Workflow UI Manager
	const ui = new WorkflowUIManager(template.name);
	if (debugLogPath) {
		ui.setDebugLogPath(debugLogPath);
	}

	// Pre-populate timeline with all workflow steps BEFORE starting UI
	// This prevents duplicate renders at startup
	// Set initial status based on completion tracking
	template.steps.forEach((step, stepIndex) => {
		if (step.type === "module") {
			const defaultEngine = registry.getDefault();
			const engineType = step.engine ?? defaultEngine?.metadata.id ?? "unknown";
			const engineName = engineType; // preserve original engine type, even if unknown

			// Create a unique identifier for each step instance (agentId + stepIndex)
			// This allows multiple instances of the same agent to appear separately in the UI
			const uniqueAgentId = `${step.agentId}-step-${stepIndex}`;

			// Determine initial status based on completion tracking
			let initialStatus: "pending" | "completed" = "pending";
			if (completedSteps.includes(stepIndex)) {
				initialStatus = "completed";
			}

			const agentId = ui.addMainAgent(
				step.agentName ?? step.agentId,
				engineName,
				stepIndex,
				initialStatus,
				uniqueAgentId,
			);

			// Update agent with step information
			const state = ui.getState();
			const agent = state.agents.find((a) => a.id === agentId);
			if (agent) {
				agent.stepIndex = stepIndex;
				agent.totalSteps = template.steps.filter(
					(s) => s.type === "module",
				).length;
			}
		} else if (step.type === "ui") {
			// Pre-populate UI elements
			ui.addUIElement(step.text, stepIndex);
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
	process.on("workflow:stop", stopListener);

	try {
		for (let index = startIndex; index < template.steps.length; index += 1) {
			// Check if workflow should stop (Ctrl+C pressed)
			if (workflowShouldStop) {
				console.log(formatAgentLog("workflow", "Workflow stopped by user."));
				break;
			}

			const step = template.steps[index];

			// UI elements are pre-populated and don't need execution
			if (step.type === "ui") {
				continue;
			}

			if (step.type !== "module") {
				continue;
			}

			// Create unique agent ID for this step instance (matches UI pre-population)
			const uniqueAgentId = `${step.agentId}-step-${index}`;

			const skipResult = shouldSkipStep(
				step,
				index,
				completedSteps,
				activeLoop,
				ui,
				uniqueAgentId,
			);
			if (skipResult.skip) {
				ui.logMessage(uniqueAgentId, skipResult.reason!);
				continue;
			}

			logSkipDebug(step, activeLoop);

			// Update UI status to running (this clears the output buffer)
			ui.updateAgentStatus(uniqueAgentId, "running");

			// Log start message AFTER clearing buffer
			ui.logMessage(uniqueAgentId, "═".repeat(80));
			ui.logMessage(uniqueAgentId, `${step.agentName} started to work.`);

			// Reset behavior file to default "continue" before each agent run
			const behaviorFile = path.join(cwd, ".codemachine/memory/behavior.json");
			const behaviorDir = path.dirname(behaviorFile);
			if (!fs.existsSync(behaviorDir)) {
				fs.mkdirSync(behaviorDir, { recursive: true });
			}
			fs.writeFileSync(
				behaviorFile,
				JSON.stringify({ action: "continue" }, null, 2),
			);

			// Mark step as started (adds to notCompletedSteps)
			await markStepStarted(cmRoot, index);

			// Determine engine: step override > first authenticated engine
			let engineType: string;
			if (step.engine) {
				engineType = step.engine;

				// If an override is provided but not authenticated, log and fall back
				const overrideEngine = registry.get(engineType);
				const isOverrideAuthed = overrideEngine
					? await authCache.isAuthenticated(overrideEngine.metadata.id, () =>
							overrideEngine.auth.isAuthenticated(),
						)
					: false;
				if (!isOverrideAuthed) {
					const pretty = overrideEngine?.metadata.name ?? engineType;
					ui.logMessage(
						uniqueAgentId,
						`${pretty} override is not authenticated; falling back to first authenticated engine by order. Run 'codemachine auth login' to use ${pretty}.`,
					);

					// Find first authenticated engine by order (with caching)
					const engines = registry.getAll();
					let fallbackEngine = null as typeof overrideEngine | null;
					for (const eng of engines) {
						const isAuth = await authCache.isAuthenticated(
							eng.metadata.id,
							() => eng.auth.isAuthenticated(),
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
						ui.logMessage(
							uniqueAgentId,
							`Falling back to ${fallbackEngine.metadata.name} (${engineType})`,
						);
					}
				}
			} else {
				// Fallback: find first authenticated engine by order (with caching)
				const engines = registry.getAll();
				let foundEngine = null;

				for (const engine of engines) {
					const isAuth = await authCache.isAuthenticated(
						engine.metadata.id,
						() => engine.auth.isAuthenticated(),
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
					throw new Error(
						"No engines registered. Please install at least one engine.",
					);
				}

				engineType = foundEngine.metadata.id;
				ui.logMessage(
					uniqueAgentId,
					`No engine specified, using ${foundEngine.metadata.name} (${engineType})`,
				);
			}

			// Ensure the selected engine is used during execution
			// (executeStep falls back to default engine if step.engine is unset)
			// Mutate current step to carry the chosen engine forward
			step.engine = engineType;

			// Set up skip listener and abort controller for this step (covers fallback + main + triggers)
			const abortController = new AbortController();
			let skipRequested = false; // Prevent duplicate skip requests during async abort handling
			const skipListener = () => {
				if (skipRequested) {
					// Ignore duplicate skip events (user pressing Ctrl+S rapidly)
					// This prevents multiple "Skip requested" messages during Bun.spawn's async termination
					return;
				}
				skipRequested = true;
				ui.logMessage(uniqueAgentId, "⏭️  Skip requested by user...");
				abortController.abort();
			};
			process.once("workflow:skip", skipListener);

			try {
				// Check if fallback should be executed before the original step
				if (shouldExecuteFallback(step, index, notCompletedSteps)) {
					ui.logMessage(
						uniqueAgentId,
						`Detected incomplete step. Running fallback agent first.`,
					);
					try {
						await executeFallbackStep(
							step,
							cwd,
							workflowStartTime,
							engineType,
							ui,
							uniqueAgentId,
							abortController.signal,
						);
					} catch (error) {
						// Fallback failed, step remains in notCompletedSteps
						ui.logMessage(
							uniqueAgentId,
							`Fallback failed. Skipping original step retry.`,
						);
						// Don't update status to failed - just let it stay as running or retrying
						throw error;
					}
				}

				const output = await executeStep(step, cwd, {
					logger: () => {}, // No-op: UI reads from log files
					stderrLogger: () => {}, // No-op: UI reads from log files
					ui,
					abortSignal: abortController.signal,
					uniqueAgentId,
				});

				// Check for trigger behavior first
				const triggerResult = await handleTriggerLogic(step, output, cwd, ui);
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
							abortSignal: abortController.signal,
						});
					} catch (triggerError) {
						// Check if this was a user-requested skip (abort)
						if (
							triggerError instanceof Error &&
							triggerError.name === "AbortError"
						) {
							ui.updateAgentStatus(triggeredAgentId, "skipped");
							ui.logMessage(
								triggeredAgentId,
								`Triggered agent was skipped by user.`,
							);
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
				ui.updateAgentStatus(uniqueAgentId, "completed");

				// Log completion messages BEFORE loop check (so they're part of current agent's output)
				ui.logMessage(
					uniqueAgentId,
					`${step.agentName} has completed their work.`,
				);
				ui.logMessage(uniqueAgentId, "\n" + "═".repeat(80) + "\n");

				// Check for checkpoint behavior first (to pause workflow for manual review)
				const checkpointResult = await handleCheckpointLogic(
					step,
					output,
					cwd,
					ui,
				);
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
							process.removeListener("checkpoint:continue", continueHandler);
							process.removeListener("checkpoint:quit", quitHandler);
						};

						process.once("checkpoint:continue", continueHandler);
						process.once("checkpoint:quit", quitHandler);
					});

					// Clear checkpoint state and resume
					ui.clearCheckpointState();

					if (workflowShouldStop) {
						// User chose to quit from checkpoint - set status to stopped
						ui.setWorkflowStatus("stopped");
						break; // User chose to quit
					}
					// Otherwise continue to next step (current step already marked complete via executeOnce)
				}

				const loopResult = await handleLoopLogic(
					step,
					index,
					output,
					loopCounters,
					cwd,
					ui,
				);

				if (loopResult.decision?.shouldRepeat) {
					// Set active loop with skip list
					activeLoop = createActiveLoop(loopResult.decision);

					// Update UI loop state
					const loopKey = `${step.module?.id ?? step.agentId}:${index}`;
					const iteration = (loopCounters.get(loopKey) || 0) + 1;
					ui.setLoopState({
						active: true,
						sourceAgent: uniqueAgentId,
						backSteps: loopResult.decision.stepsBack,
						iteration,
						maxIterations:
							step.module?.behavior?.type === "loop"
								? (step.module.behavior.maxIterations ?? Infinity)
								: Infinity,
						skipList: loopResult.decision.skipList || [],
						reason: loopResult.decision.reason,
					});

					// Reset all agents that will be re-executed in the loop
					// Clear their UI data (telemetry, tool counts, subagents) and monitoring registry data
					// Save their current state to execution history with cycle number
					for (
						let resetIndex = loopResult.newIndex;
						resetIndex <= index;
						resetIndex += 1
					) {
						const resetStep = template.steps[resetIndex];
						if (resetStep && resetStep.type === "module") {
							const resetUniqueAgentId = `${resetStep.agentId}-step-${resetIndex}`;
							await ui.resetAgentForLoop(resetUniqueAgentId, iteration);
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
					}
				}
			} catch (error) {
				// Check if this was a user-requested skip (abort)
				if (error instanceof Error && error.name === "AbortError") {
					ui.updateAgentStatus(uniqueAgentId, "skipped");
					ui.logMessage(
						uniqueAgentId,
						`${step.agentName} was skipped by user.`,
					);
					ui.logMessage(uniqueAgentId, "\n" + "═".repeat(80) + "\n");
					// Continue to next step - don't throw
				} else {
					// Don't update status to failed - let it stay as running/retrying
					ui.logMessage(
						uniqueAgentId,
						`${step.agentName} failed: ${error instanceof Error ? error.message : String(error)}`,
					);
					throw error;
				}
			} finally {
				// Always clean up the skip listener
				process.removeListener("workflow:skip", skipListener);
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
		ui.setWorkflowStatus("completed");
		// UI will stay running - user presses Ctrl+C to exit with two-stage behavior
		// Wait indefinitely - the SIGINT handler will call process.exit()
		await new Promise(() => {
			// Never resolves - keeps event loop alive until Ctrl+C exits process
		});
	} catch (error) {
		// On workflow error, set status, stop UI, then exit
		ui.setWorkflowStatus("stopped");

		// Stop UI to restore console before logging error
		ui.stop();

		// Re-throw error to be handled by caller (will now print after UI is stopped)
		throw error;
	} finally {
		// Clean up workflow stop listener
		process.removeListener("workflow:stop", stopListener);

		// Stop OpenCode server if we started one
		if (opencodeServer) {
			debug("Stopping OpenCode server...");
			await opencodeServer.stop();
		}
	}
}
