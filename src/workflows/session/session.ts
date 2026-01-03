/**
 * StepSession
 *
 * Manages step lifecycle state for each step execution.
 * Queue operations are delegated to StepIndexManager (single source of truth).
 * Tracks hasCompletedOnce to ensure chained prompts are loaded only once.
 *
 * Key responsibilities:
 * - Track session state (idle → running → awaiting → completed)
 * - Track hasCompletedOnce to load chained prompts only once
 * - Delegate queue operations to indexManager
 * - Handle start() and resume() methods
 */

import { debug } from '../../shared/logging/logger.js';
import { StatusService } from '../../agents/monitoring/index.js';
import type { StepOutput } from '../state/types.js';
import type { QueuedPrompt } from '../indexing/index.js';
import type {
  StepSessionConfig,
  StepSessionState,
} from './types.js';

export class StepSession {
  private _state: StepSessionState = 'idle';
  private _hasCompletedOnce = false;
  private _monitoringId?: number;
  private _sessionId?: string;
  private _currentOutput?: StepOutput;

  readonly config: StepSessionConfig;

  constructor(config: StepSessionConfig) {
    this.config = config;
    debug('[StepSession] Created for step %d (%s)', config.stepIndex, config.uniqueAgentId);
  }

  /**
   * Current session state
   */
  get state(): StepSessionState {
    return this._state;
  }

  /**
   * Whether this session has completed at least once
   * (used to determine if chained prompts should be loaded)
   */
  get hasCompletedOnce(): boolean {
    return this._hasCompletedOnce;
  }

  /**
   * The prompt queue for this step (delegated to indexManager)
   */
  get promptQueue(): readonly QueuedPrompt[] {
    return this.config.indexManager.promptQueue;
  }

  /**
   * Current index in prompt queue (delegated to indexManager)
   */
  get promptQueueIndex(): number {
    return this.config.indexManager.promptQueueIndex;
  }

  /**
   * Whether the prompt queue is exhausted (delegated to indexManager)
   */
  get isQueueExhausted(): boolean {
    return this.config.indexManager.isQueueExhausted();
  }

  /**
   * Current monitoring ID
   */
  get monitoringId(): number | undefined {
    return this._monitoringId;
  }

  /**
   * Current session ID
   */
  get sessionId(): string | undefined {
    return this._sessionId;
  }

  /**
   * Current output from the step
   */
  get currentOutput(): StepOutput | undefined {
    return this._currentOutput;
  }

  /**
   * Mark session as running
   */
  markRunning(): void {
    debug('[StepSession] Marking as running');
    this._state = 'running';
  }

  /**
   * Mark session as awaiting input
   */
  markAwaiting(): void {
    debug('[StepSession] Marking as awaiting');
    this._state = 'awaiting';
  }

  /**
   * Mark session as completed
   */
  markCompleted(): void {
    debug('[StepSession] Marking as completed');
    this._state = 'completed';
    this._hasCompletedOnce = true;
  }

  /**
   * Complete the session and mark monitoring as complete
   * (Moved from AgentRunner to centralize completion logic)
   */
  async complete(): Promise<void> {
    debug('[StepSession] Completing session');
    this.markCompleted();

    // Mark monitoring agent as complete via StatusService (DB + UI)
    if (this._monitoringId !== undefined) {
      const status = StatusService.getInstance();
      status.register(this._monitoringId, this.config.uniqueAgentId);
      debug('[StepSession] Marking monitoring agent %d as completed', this._monitoringId);
      await status.complete(this._monitoringId);
    }
  }

  /**
   * Set the output from step execution
   */
  setOutput(output: StepOutput): void {
    this._currentOutput = output;
    this._monitoringId = output.monitoringId;
  }

  /**
   * Set the session ID (from engine)
   */
  setSessionId(sessionId: string): void {
    this._sessionId = sessionId;
  }

  /**
   * Load chained prompts (only if not already loaded)
   * Returns true if prompts were loaded, false if already loaded
   * Delegates to indexManager for queue storage.
   */
  loadChainedPrompts(prompts: QueuedPrompt[] | undefined): boolean {
    // Only load chained prompts on first completion
    if (this._hasCompletedOnce) {
      debug('[StepSession] Already completed once, not loading chained prompts');
      return false;
    }

    if (!prompts || prompts.length === 0) {
      debug('[StepSession] No chained prompts to load');
      return false;
    }

    debug('[StepSession] Loading %d chained prompts via indexManager', prompts.length);
    this.config.indexManager.initQueue(prompts, 0);
    this._hasCompletedOnce = true; // Prevent re-loading on resume
    return true;
  }

  /**
   * Initialize prompt queue from persisted data (for resume)
   * Delegates to indexManager for queue storage.
   */
  initializeFromPersisted(queue: QueuedPrompt[], index: number): void {
    debug('[StepSession] Initializing from persisted data via indexManager: %d prompts, index %d', queue.length, index);
    this.config.indexManager.initQueue(queue, index);
    // If we have a non-zero index, we've completed at least once
    if (index > 0 || queue.length > 0) {
      this._hasCompletedOnce = true;
    }
  }

  /**
   * Advance the prompt queue by one
   * Returns the completed prompt or undefined if queue is exhausted
   * Delegates to indexManager for queue operations.
   */
  advanceQueue(): QueuedPrompt | undefined {
    const current = this.config.indexManager.getCurrentQueuedPrompt();
    if (!current) {
      debug('[StepSession] Queue exhausted, cannot advance');
      return undefined;
    }

    this.config.indexManager.advanceQueue();
    debug('[StepSession] Advanced queue to index %d', this.config.indexManager.promptQueueIndex);
    return current;
  }

  /**
   * Check if input matches the next queued prompt
   * Delegates to indexManager.
   */
  isQueuedPrompt(input: string): boolean {
    return this.config.indexManager.isQueuedPrompt(input);
  }

  /**
   * Get current queue state for InputContext
   * Reads from indexManager (single source of truth).
   */
  getQueueState(): { promptQueue: QueuedPrompt[]; promptQueueIndex: number } {
    return {
      promptQueue: [...this.config.indexManager.promptQueue],
      promptQueueIndex: this.config.indexManager.promptQueueIndex,
    };
  }

}
