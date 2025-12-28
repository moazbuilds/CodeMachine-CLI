import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { StepData } from './template.js';
import { debug } from '../logging/logger.js';

const TEMPLATE_TRACKING_FILE = 'template.json';

interface TemplateTracking {
  activeTemplate: string;
  lastUpdated: string;
  completedSteps?: Record<string, StepData> | number[]; // Support both old and new formats
  notCompletedSteps?: number[];
  resumeFromLastStep?: boolean;
}

/**
 * Creates default template tracking data
 */
function createDefaultData(): TemplateTracking {
  return {
    activeTemplate: '',
    lastUpdated: new Date().toISOString(),
    completedSteps: {},
    notCompletedSteps: [],
    resumeFromLastStep: true,
  };
}

/**
 * Migrates old number[] format to new Record<string, StepData> format
 */
function migrateCompletedSteps(data: TemplateTracking): Record<string, StepData> {
  if (Array.isArray(data.completedSteps)) {
    const oldSteps = data.completedSteps as number[];
    const newSteps: Record<string, StepData> = {};
    for (const idx of oldSteps) {
      newSteps[String(idx)] = {
        sessionId: '',
        monitoringId: 0,
        completedAt: new Date().toISOString(),
      };
    }
    return newSteps;
  }
  return data.completedSteps ?? {};
}

/**
 * Reads and migrates template tracking data
 */
async function readTrackingData(cmRoot: string): Promise<{ data: TemplateTracking; trackingPath: string }> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);
  debug('[readTrackingData] Reading from: %s', trackingPath);

  if (!existsSync(trackingPath)) {
    debug('[readTrackingData] File does not exist, returning default data');
    return { data: createDefaultData(), trackingPath };
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    debug('[readTrackingData] Raw JSON content: %s', content);
    const data = JSON.parse(content) as TemplateTracking;
    debug('[readTrackingData] Parsed data before migration: %O', data);
    // Migrate old format if needed
    const wasMigrated = Array.isArray(data.completedSteps);
    data.completedSteps = migrateCompletedSteps(data);
    if (wasMigrated) {
      debug('[readTrackingData] Migrated old array format to new Record format');
    }
    debug('[readTrackingData] Final data: %O', data);
    return { data, trackingPath };
  } catch (error) {
    debug('[readTrackingData] Failed to parse: %s', error instanceof Error ? error.message : String(error));
    console.warn(`Failed to read tracking file: ${error instanceof Error ? error.message : String(error)}`);
    return { data: createDefaultData(), trackingPath };
  }
}

/**
 * Writes template tracking data
 */
async function writeTrackingData(trackingPath: string, data: TemplateTracking): Promise<void> {
  data.lastUpdated = new Date().toISOString();
  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Gets the list of fully completed step indices (those with completedAt set).
 */
export async function getCompletedSteps(cmRoot: string): Promise<number[]> {
  debug('[getCompletedSteps] Getting completed steps for cmRoot=%s', cmRoot);
  const { data } = await readTrackingData(cmRoot);
  const completedSteps = data.completedSteps as Record<string, StepData>;

  debug('[getCompletedSteps] completedSteps record: %O', completedSteps);

  const result = Object.entries(completedSteps)
    .filter(([key, stepData]) => {
      const hasCompletedAt = stepData.completedAt !== undefined;
      debug('[getCompletedSteps] Step %s: completedAt=%s, included=%s', key, stepData.completedAt, hasCompletedAt);
      return hasCompletedAt;
    })
    .map(([key]) => parseInt(key, 10))
    .sort((a, b) => a - b);

  debug('[getCompletedSteps] Final completed step indices: %O', result);
  return result;
}

/**
 * Gets step data for a specific step index.
 */
export async function getStepData(cmRoot: string, stepIndex: number): Promise<StepData | null> {
  const { data } = await readTrackingData(cmRoot);
  const completedSteps = data.completedSteps as Record<string, StepData>;
  return completedSteps[String(stepIndex)] ?? null;
}

/**
 * Checks if a specific step is fully completed.
 */
export async function isStepCompleted(cmRoot: string, stepIndex: number): Promise<boolean> {
  const stepData = await getStepData(cmRoot, stepIndex);
  return stepData?.completedAt !== undefined;
}

/**
 * Marks a step as started.
 * Adds the step to notCompletedSteps for crash recovery.
 * Session data can be added later via updateStepSession.
 */
export async function markStepStarted(cmRoot: string, stepIndex: number): Promise<void> {
  const { data, trackingPath } = await readTrackingData(cmRoot);

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
 * Initializes step data with session info.
 * Creates or updates the step entry with sessionId and monitoringId.
 */
export async function initStepSession(
  cmRoot: string,
  stepIndex: number,
  sessionId: string,
  monitoringId: number
): Promise<void> {
  const { data, trackingPath } = await readTrackingData(cmRoot);
  const completedSteps = data.completedSteps as Record<string, StepData>;
  const key = String(stepIndex);

  // Create or update step data (preserve completedChains if exists)
  const existing = completedSteps[key];
  completedSteps[key] = {
    sessionId,
    monitoringId,
    completedChains: existing?.completedChains,
    // Don't set completedAt - step is not done yet
  };

  await writeTrackingData(trackingPath, data);
}

/**
 * Updates session data for an existing step.
 */
export async function updateStepSession(
  cmRoot: string,
  stepIndex: number,
  sessionId: string,
  monitoringId: number
): Promise<void> {
  const { data, trackingPath } = await readTrackingData(cmRoot);
  const completedSteps = data.completedSteps as Record<string, StepData>;
  const key = String(stepIndex);

  const existing = completedSteps[key];
  if (existing) {
    existing.sessionId = sessionId;
    existing.monitoringId = monitoringId;
    await writeTrackingData(trackingPath, data);
  }
}

/**
 * Marks a chain index as completed within a step.
 */
export async function markChainCompleted(
  cmRoot: string,
  stepIndex: number,
  chainIndex: number
): Promise<void> {
  const { data, trackingPath } = await readTrackingData(cmRoot);
  const completedSteps = data.completedSteps as Record<string, StepData>;
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
 * Marks a step as fully completed.
 * Sets completedAt timestamp and removes completedChains.
 */
export async function markStepCompleted(cmRoot: string, stepIndex: number): Promise<void> {
  const { data, trackingPath } = await readTrackingData(cmRoot);
  const completedSteps = data.completedSteps as Record<string, StepData>;
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

  // Remove from notCompletedSteps
  if (data.notCompletedSteps) {
    data.notCompletedSteps = data.notCompletedSteps.filter((idx) => idx !== stepIndex);
  }

  await writeTrackingData(trackingPath, data);
}

/**
 * Gets resume info for a step with incomplete chains.
 * Returns the step with completedChains but no completedAt.
 */
export async function getChainResumeInfo(cmRoot: string): Promise<{
  stepIndex: number;
  chainIndex: number;
  sessionId: string;
  monitoringId: number;
} | null> {
  const { data } = await readTrackingData(cmRoot);
  const completedSteps = data.completedSteps as Record<string, StepData>;

  for (const [key, stepData] of Object.entries(completedSteps)) {
    // Find step with chains but not fully completed
    if (stepData.completedChains && stepData.completedChains.length > 0 && !stepData.completedAt) {
      const maxChain = Math.max(...stepData.completedChains);
      return {
        stepIndex: parseInt(key, 10),
        chainIndex: maxChain + 1, // Next chain to run
        sessionId: stepData.sessionId,
        monitoringId: stepData.monitoringId,
      };
    }
  }

  return null;
}

/**
 * Clears all completed steps from the tracking file.
 */
export async function clearCompletedSteps(cmRoot: string): Promise<void> {
  const { data, trackingPath } = await readTrackingData(cmRoot);
  data.completedSteps = {};
  await writeTrackingData(trackingPath, data);
}

/**
 * Gets the list of steps that started but have not completed yet.
 */
export async function getNotCompletedSteps(cmRoot: string): Promise<number[]> {
  const { data } = await readTrackingData(cmRoot);
  return data.notCompletedSteps ?? [];
}

/**
 * Removes a step from the notCompletedSteps array.
 */
export async function removeFromNotCompleted(cmRoot: string, stepIndex: number): Promise<void> {
  const { data, trackingPath } = await readTrackingData(cmRoot);

  if (data.notCompletedSteps) {
    data.notCompletedSteps = data.notCompletedSteps.filter((idx) => idx !== stepIndex);
    await writeTrackingData(trackingPath, data);
  }
}

/**
 * Clears all not completed steps from the tracking file.
 */
export async function clearNotCompletedSteps(cmRoot: string): Promise<void> {
  const { data, trackingPath } = await readTrackingData(cmRoot);
  data.notCompletedSteps = [];
  await writeTrackingData(trackingPath, data);
}

/**
 * Gets the resume starting index.
 * Priority: incomplete chains > notCompletedSteps > after last completed step > 0
 */
export async function getResumeStartIndex(cmRoot: string): Promise<number> {
  debug('[getResumeStartIndex] ========== START ==========');
  debug('[getResumeStartIndex] cmRoot=%s', cmRoot);
  const { data } = await readTrackingData(cmRoot);

  debug('[getResumeStartIndex] Full template.json data: %O', data);
  debug('[getResumeStartIndex] Decision factors: resumeFromLastStep=%s, notCompletedSteps=%O, completedSteps=%O',
    data.resumeFromLastStep, data.notCompletedSteps, data.completedSteps);

  // Check if resume feature is enabled
  if (!data.resumeFromLastStep) {
    debug('[getResumeStartIndex] DECISION: resumeFromLastStep is false → returning 0');
    debug('[getResumeStartIndex] ========== END (startIndex=0) ==========');
    return 0;
  }

  // First check for incomplete chains
  debug('[getResumeStartIndex] Checking for incomplete chains...');
  const chainResumeInfo = await getChainResumeInfo(cmRoot);
  if (chainResumeInfo) {
    debug('[getResumeStartIndex] DECISION: Found incomplete chain → returning stepIndex=%d (chainIndex=%d)',
      chainResumeInfo.stepIndex, chainResumeInfo.chainIndex);
    debug('[getResumeStartIndex] ========== END (startIndex=%d) ==========', chainResumeInfo.stepIndex);
    return chainResumeInfo.stepIndex;
  }
  debug('[getResumeStartIndex] No incomplete chains found');

  // Check notCompletedSteps (crash recovery)
  if (data.notCompletedSteps && data.notCompletedSteps.length > 0) {
    const startIndex = Math.min(...data.notCompletedSteps);
    debug('[getResumeStartIndex] DECISION: notCompletedSteps has entries → returning min=%d from %O',
      startIndex, data.notCompletedSteps);
    debug('[getResumeStartIndex] ========== END (startIndex=%d) ==========', startIndex);
    return startIndex;
  }
  debug('[getResumeStartIndex] notCompletedSteps is empty or undefined');

  // Check completedSteps - if all steps done, start after the last one
  const completedSteps = data.completedSteps as Record<string, StepData>;
  debug('[getResumeStartIndex] Checking completedSteps record...');
  if (completedSteps && typeof completedSteps === 'object') {
    const completedIndices = Object.entries(completedSteps)
      .filter(([key, stepData]) => {
        const hasCompletedAt = stepData.completedAt !== undefined;
        debug('[getResumeStartIndex] Step %s: completedAt=%s, isCompleted=%s', key, stepData.completedAt, hasCompletedAt);
        return hasCompletedAt;
      })
      .map(([key]) => parseInt(key, 10));

    debug('[getResumeStartIndex] Completed step indices: %O', completedIndices);

    if (completedIndices.length > 0) {
      const maxCompleted = Math.max(...completedIndices);
      const startIndex = maxCompleted + 1;
      debug('[getResumeStartIndex] DECISION: Found completed steps → max=%d, returning startIndex=%d',
        maxCompleted, startIndex);
      debug('[getResumeStartIndex] ========== END (startIndex=%d) ==========', startIndex);
      return startIndex;
    }
  }

  debug('[getResumeStartIndex] DECISION: No resume conditions met → returning 0');
  debug('[getResumeStartIndex] ========== END (startIndex=0) ==========');
  return 0;
}
