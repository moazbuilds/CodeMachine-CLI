import { AgentMonitorService } from './monitor.js';
import { AgentLoggerService } from './logger.js';
import { DurationTimerService } from './duration-timer.js';
import * as logger from '../../shared/logging/logger.js';
import { killAllActiveProcesses } from '../../infra/process/spawn.js';
import {
  saveAutopilotModeState,
  setStepDuration,
  updateWorkflowAccumulatedDuration,
} from '../../shared/workflows/steps.js';

/**
 * Handles graceful cleanup of monitoring state on process termination
 * Ensures all running agents are marked as failed/aborted and logs are closed
 */
export class MonitoringCleanup {
  private static isSetup = false;
  private static isCleaningUp = false;
  private static firstCtrlCPressed = false;
  private static firstCtrlCTime = 0;
  private static readonly CTRL_C_DEBOUNCE_MS = 500; // Require 500ms between Ctrl+C presses
  private static readonly EXIT_STATUS_DELAY_MS = 150; // Give UI time to render "Stopped" state
  private static workflowHandlers: {
    onStop?: () => void;
    onExit?: () => void;
  } = {};
  private static workflowState: {
    cmRoot?: string;
    getAutoMode?: () => boolean;
    getCurrentStepIndex?: () => number;
    getSessionStartTime?: () => number;
  } = {};

  /**
   * Register callbacks invoked during the two-stage Ctrl+C flow.
   */
  static registerWorkflowHandlers(handlers: { onStop?: () => void; onExit?: () => void }): void {
    this.workflowHandlers = handlers;
  }

  static clearWorkflowHandlers(): void {
    this.workflowHandlers = {};
  }

  /**
   * Register workflow state for persistence on cleanup.
   * This allows saving auto mode state when pausing and syncing durations.
   */
  static registerWorkflowState(state: {
    cmRoot: string;
    getAutoMode: () => boolean;
    getCurrentStepIndex?: () => number;
    getSessionStartTime?: () => number;
  }): void {
    this.workflowState = state;
  }

  static clearWorkflowState(): void {
    this.workflowState = {};
  }

  /**
   * Reset the Ctrl+C state between workflow runs so the next workflow
   * always starts with the two-stage behavior.
   */
  private static resetCtrlCState(): void {
    this.firstCtrlCPressed = false;
    this.firstCtrlCTime = 0;
  }

  /**
   * Terminate any running agent processes and mark them as paused without
   * exiting the CLI. This is invoked on the first Ctrl+C so that the workflow
   * actually stops executing while we keep the UI alive.
   */
  private static async stopActiveAgents(): Promise<void> {
    logger.debug('Stopping active agents after first Ctrl+C...');
    killAllActiveProcesses();
    await this.cleanup('paused', new Error('User interrupted (Ctrl+C)'));
  }

  /**
   * Set up signal handlers for graceful cleanup
   * Should be called once at application startup
   */
  static setup(): void {
    // Reset on every setup invocation to avoid carrying state
    this.resetCtrlCState();

    if (this.isSetup) {
      return; // Already set up
    }

    this.isSetup = true;

    // Handle Ctrl+C (SIGINT) with two-stage behavior
    process.on('SIGINT', () => {
      void this.handleCtrlCPress('signal');
    });

    // Handle termination signal (SIGTERM)
    process.on('SIGTERM', async () => {
      await this.handleSignal('SIGTERM', 'Process terminated');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: Error) => {
      logger.error('Uncaught exception:', error);
      await this.cleanup('failed', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger.error('Unhandled rejection:', error);
      await this.cleanup('failed', error);
      process.exit(1);
    });

    logger.debug('MonitoringCleanup signal handlers initialized');
  }

  /**
   * Public entrypoint for UI components to trigger the two-stage Ctrl+C flow
   * without relying on terminal-delivered SIGINT events.
   */
  static async triggerCtrlCFromUI(): Promise<void> {
    if (!this.isSetup) {
      this.setup();
    }
    await this.handleCtrlCPress('ui');
  }

  /**
   * Centralized Ctrl+C handling shared by both UI triggers and process signals.
   */
  private static async handleCtrlCPress(source: 'signal' | 'ui'): Promise<void> {
    if (!this.firstCtrlCPressed) {
      // First Ctrl+C: Just show warning, workflow continues running
      this.firstCtrlCPressed = true;
      this.firstCtrlCTime = Date.now();
      logger.debug(`[${source}] First Ctrl+C detected - showing warning (workflow continues)`);

      // Only update UI to show warning - don't stop anything yet
      this.workflowHandlers.onStop?.();

      // Don't exit - wait for second Ctrl+C
      return;
    }

    // Check if enough time has passed since first Ctrl+C
    const timeSinceFirst = Date.now() - this.firstCtrlCTime;
    if (timeSinceFirst < this.CTRL_C_DEBOUNCE_MS) {
      logger.debug(
        `[${source}] Ignoring Ctrl+C - too soon (${timeSinceFirst}ms < ${this.CTRL_C_DEBOUNCE_MS}ms). Press Ctrl+C again to exit.`
      );
      return;
    }

    // Second Ctrl+C (after debounce): Stop workflow and exit
    logger.debug(`[${source}] Second Ctrl+C detected after ${timeSinceFirst}ms - stopping workflow and exiting`);

    // Emit workflow:skip to abort the currently running step
    (process as NodeJS.EventEmitter).emit('workflow:skip');

    // Stop active agents
    await this.stopActiveAgents();

    // Call UI callback to update status before exit
    this.workflowHandlers.onExit?.();

    // Give the UI a moment to render the stopped status before shutting down
    await new Promise((resolve) => setTimeout(resolve, this.EXIT_STATUS_DELAY_MS));

    await this.handleSignal('SIGINT', 'User interrupted (Ctrl+C)');
  }

  /**
   * Handle process signal
   */
  private static async handleSignal(signal: string, message: string): Promise<void> {
    logger.debug(`Received ${signal}: ${message}`);

    // Kill all active child processes before cleanup
    logger.debug('Killing all active child processes...');
    killAllActiveProcesses();

    await this.cleanup('aborted', new Error(message));

    // Clean terminal before exit to prevent Kitty protocol escape sequence leak
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?2004l');  // Disable bracketed paste
      process.stdout.write('\x1b[<u');      // Pop Kitty keyboard mode
      process.stdout.write('\x1b[2J\x1b[H\x1b[?25h'); // Clear screen, home cursor, show cursor
    }

    process.exit(130); // Standard exit code for Ctrl+C
  }

  /**
   * Clean up all running agents
   */
  private static async cleanup(reason: 'failed' | 'aborted' | 'paused', error?: Error): Promise<void> {
    if (this.isCleaningUp) {
      return; // Already cleaning up, avoid recursion
    }

    this.isCleaningUp = true;

    try {
      // Save autopilot mode state if pausing (for resume)
      if (reason === 'paused' && this.workflowState.cmRoot && this.workflowState.getAutoMode) {
        try {
          const isAutoMode = this.workflowState.getAutoMode();
          await saveAutopilotModeState(this.workflowState.cmRoot, isAutoMode);
          logger.debug(`Saved autopilot mode state: ${isAutoMode}`);
        } catch (err) {
          logger.warn('Failed to save autopilot mode state:', err);
        }
      }

      const monitor = AgentMonitorService.getInstance();
      const loggerService = AgentLoggerService.getInstance();
      const timerService = DurationTimerService.getInstance();

      const runningAgents = monitor.getActiveAgents();

      if (runningAgents.length > 0) {
        logger.debug(`Cleaning up ${runningAgents.length} running agent(s) with reason: ${reason}`);

        for (const agent of runningAgents) {
          try {
            if (reason === 'paused') {
              // Mark as paused - preserves state for resume
              await monitor.markPaused(agent.id);
              logger.debug(`Marked agent ${agent.id} (${agent.name}) as paused`);
            } else {
              // Mark as failed
              const errorMsg = error || new Error(`Agent ${reason}: ${agent.name}`);
              await monitor.fail(agent.id, errorMsg);
              logger.debug(`Marked agent ${agent.id} (${agent.name}) as ${reason}`);
            }

            // Close log stream (now async)
            await loggerService.closeStream(agent.id);
          } catch (cleanupError) {
            logger.error(`Failed to cleanup agent ${agent.id}:`, cleanupError);
          }
        }

        // Stop all remaining timers
        timerService.stopAllTimers();

        // Sync agent duration to template.json for resume
        if (reason === 'paused' && this.workflowState.cmRoot && this.workflowState.getCurrentStepIndex) {
          try {
            const stepIndex = this.workflowState.getCurrentStepIndex();
            // Get the agent for the current step (should be one of the paused agents)
            // After markPaused, the agent record has the correct accumulatedDuration from SQLite
            for (const agent of runningAgents) {
              const agentRecord = monitor.getAgent(agent.id);
              if (agentRecord?.accumulatedDuration !== undefined) {
                // Use setStepDuration (not updateStepDuration) because we're syncing the TOTAL
                // accumulated duration from SQLite, not adding to it
                await setStepDuration(this.workflowState.cmRoot, stepIndex, agentRecord.accumulatedDuration);
                logger.debug(`Synced agent ${agent.id} duration (${agentRecord.accumulatedDuration}ms) to template.json step ${stepIndex}`);
                break; // Only one running agent per step
              }
            }
          } catch (err) {
            logger.warn('Failed to sync agent duration to template.json:', err);
          }
        }

        // Save workflow accumulated duration for resume
        if (reason === 'paused' && this.workflowState.cmRoot && this.workflowState.getSessionStartTime) {
          try {
            const sessionStartTime = this.workflowState.getSessionStartTime();
            const sessionDuration = Date.now() - sessionStartTime;
            await updateWorkflowAccumulatedDuration(this.workflowState.cmRoot, sessionDuration);
            logger.debug(`Saved workflow session duration: ${sessionDuration}ms`);
          } catch (err) {
            logger.warn('Failed to save workflow accumulated duration:', err);
          }
        }

        // Release any remaining locks
        await loggerService.releaseAllLocks();

        logger.debug('Cleanup complete');
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Manually trigger cleanup (for testing or explicit cleanup)
   */
  static async forceCleanup(): Promise<void> {
    await this.cleanup('failed', new Error('Manual cleanup'));
  }
}
