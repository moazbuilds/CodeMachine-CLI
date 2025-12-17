import { AgentRepository } from './db/repository.js';
import { getDB } from './db/connection.js';
import * as logger from '../../shared/logging/logger.js';

interface ActiveTimer {
  agentId: number;
  startTime: number;
  accumulatedPrior: number; // Duration from previous sessions
  intervalId: ReturnType<typeof setInterval>;
}

/**
 * Manages per-second duration persistence for running agents.
 * Ensures duration is never lost even on crash.
 */
export class DurationTimerService {
  private static instance: DurationTimerService;
  private repository: AgentRepository;
  private activeTimers = new Map<number, ActiveTimer>();

  private constructor() {
    const db = getDB();
    this.repository = new AgentRepository(db);
  }

  static getInstance(): DurationTimerService {
    if (!DurationTimerService.instance) {
      DurationTimerService.instance = new DurationTimerService();
    }
    return DurationTimerService.instance;
  }

  /**
   * Start tracking duration for an agent.
   * Called when agent starts running.
   */
  startTimer(agentId: number, accumulatedPrior: number = 0): void {
    // Guard: Don't restart if timer already running for this agent
    const existing = this.activeTimers.get(agentId);
    if (existing) {
      logger.debug(`Timer already running for agent ${agentId}, skipping restart`);
      return;
    }

    const startTime = Date.now();

    // Persist immediately
    this.persistDuration(agentId, accumulatedPrior);

    // Set up 1-second interval
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const total = accumulatedPrior + elapsed;
      this.persistDuration(agentId, total);
    }, 1000);

    this.activeTimers.set(agentId, {
      agentId,
      startTime,
      accumulatedPrior,
      intervalId,
    });

    logger.debug(`Started duration timer for agent ${agentId}`);
  }

  /**
   * Stop timer and return final accumulated duration.
   * Called when agent completes, fails, or pauses.
   */
  stopTimer(agentId: number): number {
    const timer = this.activeTimers.get(agentId);
    if (!timer) return 0;

    clearInterval(timer.intervalId);

    const elapsed = Date.now() - timer.startTime;
    const total = timer.accumulatedPrior + elapsed;

    // Final persist
    this.persistDuration(agentId, total);

    this.activeTimers.delete(agentId);
    logger.debug(`Stopped duration timer for agent ${agentId}, total: ${total}ms`);

    return total;
  }

  /**
   * Pause timer - captures current duration for resume.
   * Returns accumulated duration to this point.
   */
  pauseTimer(agentId: number): number {
    return this.stopTimer(agentId);
  }

  /**
   * Resume timer with previously accumulated duration.
   */
  resumeTimer(agentId: number, accumulatedPrior: number): void {
    this.startTimer(agentId, accumulatedPrior);
  }

  /**
   * Get current duration (without persisting).
   */
  getCurrentDuration(agentId: number): number {
    const timer = this.activeTimers.get(agentId);
    if (!timer) return 0;

    const elapsed = Date.now() - timer.startTime;
    return timer.accumulatedPrior + elapsed;
  }

  /**
   * Check if a timer is active for an agent.
   */
  hasActiveTimer(agentId: number): boolean {
    return this.activeTimers.has(agentId);
  }

  /**
   * Stop all active timers (for cleanup).
   */
  stopAllTimers(): void {
    for (const [agentId] of this.activeTimers) {
      this.stopTimer(agentId);
    }
  }

  private persistDuration(agentId: number, duration: number): void {
    try {
      this.repository.persistDuration(agentId, duration);
    } catch (err) {
      logger.warn(`Failed to persist duration for agent ${agentId}: ${err}`);
    }
  }
}
