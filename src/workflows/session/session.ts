/**
 * StepSession
 *
 * Owns step lifecycle and promptQueue for each step execution.
 * Tracks hasCompletedOnce to ensure chained prompts are loaded only once.
 *
 * Key responsibilities:
 * - Track session state (idle → running → awaiting → completed)
 * - Own promptQueue for THIS step
 * - Track hasCompletedOnce to load chained prompts only once
 * - Handle start() and resume() methods
 */

import { debug } from '../../shared/logging/logger.js';
import { AgentMonitorService } from '../../agents/monitoring/index.js';
import type { QueuedPrompt, StepOutput } from '../state/types.js';
import type {
  StepSessionConfig,
  StepSessionState,
} from './types.js';

export class StepSession {
  private _state: StepSessionState = 'idle';
  private _hasCompletedOnce = false;
  private _promptQueue: QueuedPrompt[] = [];
  private _promptQueueIndex = 0;
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
   * The prompt queue for this step
   */
  get promptQueue(): readonly QueuedPrompt[] {
    return this._promptQueue;
  }

  /**
   * Current index in prompt queue
   */
  get promptQueueIndex(): number {
    return this._promptQueueIndex;
  }

  /**
   * Whether the prompt queue is exhausted
   */
  get isQueueExhausted(): boolean {
    return this._promptQueueIndex >= this._promptQueue.length;
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

    // Mark monitoring agent as complete
    if (this._monitoringId !== undefined) {
      const monitor = AgentMonitorService.getInstance();
      debug('[StepSession] Marking monitoring agent %d as completed', this._monitoringId);
      await monitor.complete(this._monitoringId);
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

    debug('[StepSession] Loading %d chained prompts', prompts.length);
    this._promptQueue = prompts;
    this._promptQueueIndex = 0;
    this._hasCompletedOnce = true; // Prevent re-loading on resume
    return true;
  }

  /**
   * Initialize prompt queue from persisted data (for resume)
   */
  initializeFromPersisted(queue: QueuedPrompt[], index: number): void {
    debug('[StepSession] Initializing from persisted data: %d prompts, index %d', queue.length, index);
    this._promptQueue = queue;
    this._promptQueueIndex = index;
    // If we have a non-zero index, we've completed at least once
    if (index > 0 || queue.length > 0) {
      this._hasCompletedOnce = true;
    }
  }

  /**
   * Advance the prompt queue by one
   * Returns the completed prompt or undefined if queue is exhausted
   */
  advanceQueue(): QueuedPrompt | undefined {
    if (this._promptQueueIndex >= this._promptQueue.length) {
      debug('[StepSession] Queue exhausted, cannot advance');
      return undefined;
    }

    const completed = this._promptQueue[this._promptQueueIndex];
    this._promptQueueIndex += 1;
    debug('[StepSession] Advanced queue to index %d', this._promptQueueIndex);
    return completed;
  }

  /**
   * Check if input matches the next queued prompt
   */
  isQueuedPrompt(input: string): boolean {
    if (this._promptQueueIndex >= this._promptQueue.length) {
      return false;
    }
    return input === this._promptQueue[this._promptQueueIndex].content;
  }

  /**
   * Get current queue state for InputContext
   */
  getQueueState(): { promptQueue: QueuedPrompt[]; promptQueueIndex: number } {
    return {
      promptQueue: [...this._promptQueue],
      promptQueueIndex: this._promptQueueIndex,
    };
  }

  /**
   * Sync state to machine context
   * (For backwards compatibility during transition)
   */
  syncToMachineContext(machineCtx: {
    promptQueue: QueuedPrompt[];
    promptQueueIndex: number;
    currentOutput: StepOutput | null;
    currentMonitoringId?: number;
  }): void {
    machineCtx.promptQueue = [...this._promptQueue];
    machineCtx.promptQueueIndex = this._promptQueueIndex;
    if (this._currentOutput) {
      machineCtx.currentOutput = this._currentOutput;
      machineCtx.currentMonitoringId = this._monitoringId;
    }
  }

  /**
   * Sync state from machine context
   * (For backwards compatibility during transition)
   */
  syncFromMachineContext(machineCtx: {
    promptQueue: QueuedPrompt[];
    promptQueueIndex: number;
    currentOutput: StepOutput | null;
    currentMonitoringId?: number;
  }): void {
    this._promptQueue = [...machineCtx.promptQueue];
    this._promptQueueIndex = machineCtx.promptQueueIndex;
    if (machineCtx.currentOutput) {
      this._currentOutput = machineCtx.currentOutput;
      this._monitoringId = machineCtx.currentMonitoringId;
    }
  }
}
