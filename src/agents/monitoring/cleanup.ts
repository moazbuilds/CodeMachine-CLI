import { AgentMonitorService } from './monitor.js';
import { AgentLoggerService } from './logger.js';
import * as logger from '../../shared/logging/logger.js';

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
  private static workflowHandlers: {
    onStop?: () => void;
    onExit?: () => void;
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
   * Set up signal handlers for graceful cleanup
   * Should be called once at application startup
   */
  static setup(): void {
    if (this.isSetup) {
      return; // Already set up
    }

    this.isSetup = true;

    // Handle Ctrl+C (SIGINT) with two-stage behavior
    process.on('SIGINT', async () => {
      if (!this.firstCtrlCPressed) {
        // First Ctrl+C: Gracefully stop workflow without cleanup
        this.firstCtrlCPressed = true;
        this.firstCtrlCTime = Date.now();
        logger.debug('First Ctrl+C detected - stopping workflow gracefully');

        // Call UI callback to update status
        this.workflowHandlers.onStop?.();

        // Don't exit - wait for second Ctrl+C
        return;
      }

      // Check if enough time has passed since first Ctrl+C
      const timeSinceFirst = Date.now() - this.firstCtrlCTime;
      if (timeSinceFirst < this.CTRL_C_DEBOUNCE_MS) {
        logger.debug(`Ignoring Ctrl+C - too soon (${timeSinceFirst}ms < ${this.CTRL_C_DEBOUNCE_MS}ms). Press Ctrl+C again to exit.`);
        return;
      }

      // Second Ctrl+C (after debounce): Run cleanup and exit
      logger.debug(`Second Ctrl+C detected after ${timeSinceFirst}ms - cleaning up and exiting`);

      // Call UI callback to update status before exit
      this.workflowHandlers.onExit?.();

      await this.handleSignal('SIGINT', 'User interrupted (Ctrl+C)');
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
   * Handle process signal
   */
  private static async handleSignal(signal: string, message: string): Promise<void> {
    logger.debug(`Received ${signal}: ${message}`);
    await this.cleanup('aborted', new Error(message));
    process.exit(130); // Standard exit code for Ctrl+C
  }

  /**
   * Clean up all running agents
   */
  private static async cleanup(reason: 'failed' | 'aborted', error?: Error): Promise<void> {
    if (this.isCleaningUp) {
      return; // Already cleaning up, avoid recursion
    }

    this.isCleaningUp = true;

    try {
      const monitor = AgentMonitorService.getInstance();
      const loggerService = AgentLoggerService.getInstance();

      const runningAgents = monitor.getActiveAgents();

      if (runningAgents.length > 0) {
        logger.debug(`Cleaning up ${runningAgents.length} running agent(s)...`);

        for (const agent of runningAgents) {
          try {
            // Mark agent as failed with appropriate error
            const errorMsg = error || new Error(`Agent ${reason}: ${agent.name}`);
            monitor.fail(agent.id, errorMsg);

            // Close log stream (now async)
            await loggerService.closeStream(agent.id);

            logger.debug(`Marked agent ${agent.id} (${agent.name}) as ${reason}`);
          } catch (cleanupError) {
            logger.error(`Failed to cleanup agent ${agent.id}:`, cleanupError);
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
