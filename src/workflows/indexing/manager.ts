/**
 * Step Index Manager
 *
 * The single source of truth for all step indexing operations.
 * Manages both in-memory state and persistence to template.json.
 */

import type { StepData, TemplateTracking, ResumeInfo } from './types.js';
import type { QueuedPrompt } from '../state/types.js';
import { ResumeDecision, StepLifecyclePhase } from './types.js';
import { readTrackingData, writeTrackingData } from './persistence.js';
import { getStepPhase, hasIncompleteChains, getNextChainIndex } from './lifecycle.js';
import { logLifecycle, logResume, logQueue, logStepData, logDebug } from './debug.js';

/**
 * StepIndexManager - manages all step indexing state
 *
 * This class is the single source of truth for:
 * - Current step index
 * - Prompt queue state
 * - Step completion status
 * - Resume information
 */
export class StepIndexManager {
  private readonly cmRoot: string;

  // In-memory state
  private _currentStepIndex: number = 0;
  private _promptQueue: QueuedPrompt[] = [];
  private _promptQueueIndex: number = 0;

  constructor(cmRoot: string) {
    this.cmRoot = cmRoot;
  }

  // ============================================
  // State Accessors
  // ============================================

  get currentStepIndex(): number {
    return this._currentStepIndex;
  }

  get promptQueue(): QueuedPrompt[] {
    return this._promptQueue;
  }

  get promptQueueIndex(): number {
    return this._promptQueueIndex;
  }

  /**
   * Sets the current step index (used during initialization or step advancement)
   */
  setCurrentStepIndex(index: number): void {
    logDebug('state', `Setting currentStepIndex from ${this._currentStepIndex} to ${index}`);
    this._currentStepIndex = index;
  }

  /**
   * Advances to the next step
   */
  advanceStep(): void {
    this._currentStepIndex += 1;
    this._promptQueue = [];
    this._promptQueueIndex = 0;
    logDebug('state', `Advanced to step ${this._currentStepIndex}`);
  }

  // ============================================
  // Queue Management
  // ============================================

  /**
   * Initializes the prompt queue for a step
   */
  initQueue(prompts: QueuedPrompt[], startIndex: number = 0): void {
    this._promptQueue = prompts;
    this._promptQueueIndex = startIndex;
    logQueue('INIT', this._currentStepIndex, startIndex, prompts.length);
  }

  /**
   * Advances the queue index
   */
  advanceQueue(): void {
    this._promptQueueIndex += 1;
    logQueue('ADVANCE', this._currentStepIndex, this._promptQueueIndex, this._promptQueue.length);
  }

  /**
   * Resets the queue
   */
  resetQueue(): void {
    this._promptQueue = [];
    this._promptQueueIndex = 0;
    logQueue('RESET', this._currentStepIndex, 0, 0);
  }

  /**
   * Gets the current queued prompt (if any)
   */
  getCurrentQueuedPrompt(): QueuedPrompt | null {
    if (this._promptQueueIndex >= this._promptQueue.length) {
      return null;
    }
    return this._promptQueue[this._promptQueueIndex];
  }

  /**
   * Checks if input matches the current queued prompt
   */
  isQueuedPrompt(input: string): boolean {
    const current = this.getCurrentQueuedPrompt();
    if (!current) return false;
    return input === current.content || input === current.label;
  }

  /**
   * Checks if queue is exhausted
   */
  isQueueExhausted(): boolean {
    return this._promptQueueIndex >= this._promptQueue.length;
  }

  // ============================================
  // Step Lifecycle Methods
  // ============================================

  /**
   * Marks a step as started (for crash recovery)
   */
  async stepStarted(stepIndex: number): Promise<void> {
    logLifecycle(StepLifecyclePhase.STARTED, stepIndex);

    const { data, trackingPath } = await readTrackingData(this.cmRoot);

    // Add to notCompletedSteps if not already there
    if (!data.notCompletedSteps) {
      data.notCompletedSteps = [];
    }
    if (!data.notCompletedSteps.includes(stepIndex)) {
      data.notCompletedSteps.push(stepIndex);
      data.notCompletedSteps.sort((a, b) => a - b);
    }

    await writeTrackingData(trackingPath, data);
  }

  /**
   * Initializes step session with agent session info
   */
  async stepSessionInitialized(
    stepIndex: number,
    sessionId: string,
    monitoringId: number
  ): Promise<void> {
    logLifecycle(StepLifecyclePhase.SESSION_INITIALIZED, stepIndex, { sessionId, monitoringId });

    const { data, trackingPath } = await readTrackingData(this.cmRoot);
    const completedSteps = data.completedSteps ?? {};
    const key = String(stepIndex);

    // Preserve completedChains if exists
    const existing = completedSteps[key];
    completedSteps[key] = {
      sessionId,
      monitoringId,
      completedChains: existing?.completedChains,
    };
    data.completedSteps = completedSteps;

    await writeTrackingData(trackingPath, data);
  }

  /**
   * Marks a chain as completed within a step
   */
  async chainCompleted(stepIndex: number, chainIndex: number): Promise<void> {
    logLifecycle('CHAIN_COMPLETED', stepIndex, { chainIndex });

    const { data, trackingPath } = await readTrackingData(this.cmRoot);
    const completedSteps = data.completedSteps ?? {};
    const key = String(stepIndex);

    const existing = completedSteps[key];
    if (existing) {
      if (!existing.completedChains) {
        existing.completedChains = [];
      }
      if (!existing.completedChains.includes(chainIndex)) {
        existing.completedChains.push(chainIndex);
        existing.completedChains.sort((a, b) => a - b);
      }
      await writeTrackingData(trackingPath, data);
    }
  }

  /**
   * Marks a step as fully completed
   */
  async stepCompleted(stepIndex: number): Promise<void> {
    logLifecycle(StepLifecyclePhase.COMPLETED, stepIndex, {
      completedAt: new Date().toISOString(),
    });

    const { data, trackingPath } = await readTrackingData(this.cmRoot);
    const completedSteps = data.completedSteps ?? {};
    const key = String(stepIndex);

    // Get or create step data
    if (!completedSteps[key]) {
      completedSteps[key] = {
        sessionId: '',
        monitoringId: 0,
      };
    }

    // Mark as completed
    completedSteps[key].completedAt = new Date().toISOString();
    // Remove completedChains - no longer needed
    delete completedSteps[key].completedChains;

    data.completedSteps = completedSteps;

    // Remove from notCompletedSteps
    if (data.notCompletedSteps) {
      data.notCompletedSteps = data.notCompletedSteps.filter((idx) => idx !== stepIndex);
    }

    await writeTrackingData(trackingPath, data);
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Gets resume information for the workflow
   */
  async getResumeInfo(): Promise<ResumeInfo> {
    logResume('========== START ==========');

    const { data } = await readTrackingData(this.cmRoot);
    const completedSteps = data.completedSteps ?? {};

    logResume('Decision factors', {
      resumeFromLastStep: data.resumeFromLastStep,
      notCompletedSteps: data.notCompletedSteps,
      completedStepsCount: Object.keys(completedSteps).length,
    });

    // Check if resume feature is enabled
    if (!data.resumeFromLastStep) {
      logResume('DECISION: resumeFromLastStep is false -> START_FRESH');
      return {
        startIndex: 0,
        decision: ResumeDecision.START_FRESH,
      };
    }

    // Check for incomplete chains
    logResume('Checking for incomplete chains...');
    for (const [key, stepData] of Object.entries(completedSteps)) {
      if (hasIncompleteChains(stepData)) {
        const stepIndex = parseInt(key, 10);
        const chainIndex = getNextChainIndex(stepData);
        logResume('DECISION: Found incomplete chain -> RESUME_FROM_CHAIN', {
          stepIndex,
          chainIndex,
        });
        return {
          startIndex: stepIndex,
          decision: ResumeDecision.RESUME_FROM_CHAIN,
          chainIndex,
          sessionId: stepData.sessionId,
          monitoringId: stepData.monitoringId,
        };
      }
    }
    logResume('No incomplete chains found');

    // Check notCompletedSteps (crash recovery)
    // Use max because steps run sequentially - the highest index is the last step that was running
    if (data.notCompletedSteps && data.notCompletedSteps.length > 0) {
      const startIndex = Math.max(...data.notCompletedSteps);
      logResume('DECISION: notCompletedSteps has entries -> RESUME_FROM_CRASH', {
        startIndex,
        notCompletedSteps: data.notCompletedSteps,
      });
      return {
        startIndex,
        decision: ResumeDecision.RESUME_FROM_CRASH,
      };
    }
    logResume('notCompletedSteps is empty');

    // Check completedSteps - start after the last completed
    const completedIndices = Object.entries(completedSteps)
      .filter(([_, stepData]) => stepData.completedAt !== undefined)
      .map(([key]) => parseInt(key, 10));

    if (completedIndices.length > 0) {
      const maxCompleted = Math.max(...completedIndices);
      const startIndex = maxCompleted + 1;
      logResume('DECISION: Found completed steps -> CONTINUE_AFTER_COMPLETED', {
        maxCompleted,
        startIndex,
      });
      return {
        startIndex,
        decision: ResumeDecision.CONTINUE_AFTER_COMPLETED,
      };
    }

    logResume('DECISION: No resume conditions met -> START_FRESH');
    logResume('========== END ==========');

    return {
      startIndex: 0,
      decision: ResumeDecision.START_FRESH,
    };
  }

  /**
   * Gets step data for a specific step index
   */
  async getStepData(stepIndex: number): Promise<StepData | null> {
    const { data } = await readTrackingData(this.cmRoot);
    const completedSteps = data.completedSteps ?? {};
    const stepData = completedSteps[String(stepIndex)] ?? null;
    logStepData(stepIndex, stepData);
    return stepData;
  }

  /**
   * Checks if a specific step is fully completed
   */
  async isStepCompleted(stepIndex: number): Promise<boolean> {
    const stepData = await this.getStepData(stepIndex);
    return stepData?.completedAt !== undefined;
  }

  /**
   * Gets list of all fully-completed step indices
   */
  async getCompletedSteps(): Promise<number[]> {
    const { data } = await readTrackingData(this.cmRoot);
    const completedSteps = data.completedSteps ?? {};

    const result = Object.entries(completedSteps)
      .filter(([_, stepData]) => stepData.completedAt !== undefined)
      .map(([key]) => parseInt(key, 10))
      .sort((a, b) => a - b);

    logDebug('query', `getCompletedSteps: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Gets list of steps that started but didn't complete
   */
  async getNotCompletedSteps(): Promise<number[]> {
    const { data } = await readTrackingData(this.cmRoot);
    return data.notCompletedSteps ?? [];
  }

  /**
   * Clears all completed steps
   */
  async clearCompletedSteps(): Promise<void> {
    const { data, trackingPath } = await readTrackingData(this.cmRoot);
    data.completedSteps = {};
    await writeTrackingData(trackingPath, data);
    logDebug('clear', 'Cleared all completed steps');
  }

  /**
   * Clears all not completed steps
   */
  async clearNotCompletedSteps(): Promise<void> {
    const { data, trackingPath } = await readTrackingData(this.cmRoot);
    data.notCompletedSteps = [];
    await writeTrackingData(trackingPath, data);
    logDebug('clear', 'Cleared all not completed steps');
  }

  /**
   * Gets the phase of a specific step
   */
  async getStepPhase(stepIndex: number): Promise<StepLifecyclePhase> {
    const stepData = await this.getStepData(stepIndex);
    return getStepPhase(stepData);
  }

  /**
   * Updates session data for an existing step
   * Use this when session info changes after initial initialization.
   */
  async updateStepSession(
    stepIndex: number,
    sessionId: string,
    monitoringId: number
  ): Promise<void> {
    logDebug('update', `Updating step ${stepIndex} session`, { sessionId, monitoringId });

    const { data, trackingPath } = await readTrackingData(this.cmRoot);
    const completedSteps = data.completedSteps ?? {};
    const key = String(stepIndex);

    const existing = completedSteps[key];
    if (existing) {
      existing.sessionId = sessionId;
      existing.monitoringId = monitoringId;
      await writeTrackingData(trackingPath, data);
    }
  }

  /**
   * Removes a step from the notCompletedSteps array
   * Use this when a step is handled (e.g., manually skipped) without completing.
   */
  async removeFromNotCompleted(stepIndex: number): Promise<void> {
    logDebug('remove', `Removing step ${stepIndex} from notCompletedSteps`);

    const { data, trackingPath } = await readTrackingData(this.cmRoot);

    if (data.notCompletedSteps) {
      data.notCompletedSteps = data.notCompletedSteps.filter((idx) => idx !== stepIndex);
      await writeTrackingData(trackingPath, data);
    }
  }
}
