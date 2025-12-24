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

  if (!existsSync(trackingPath)) {
    return { data: createDefaultData(), trackingPath };
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    // Migrate old format if needed
    data.completedSteps = migrateCompletedSteps(data);
    return { data, trackingPath };
  } catch (error) {
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
  const { data } = await readTrackingData(cmRoot);
  const completedSteps = data.completedSteps as Record<string, StepData>;

  return Object.entries(completedSteps)
    .filter(([, stepData]) => stepData.completedAt !== undefined)
    .map(([key]) => parseInt(key, 10))
    .sort((a, b) => a - b);
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
  const { data } = await readTrackingData(cmRoot);

  debug('[getResumeStartIndex] data: %O', { resumeFromLastStep: data.resumeFromLastStep, notCompletedSteps: data.notCompletedSteps });

  // Check if resume feature is enabled
  if (!data.resumeFromLastStep) {
    debug('[getResumeStartIndex] resumeFromLastStep is false, returning 0');
    return 0;
  }

  // First check for incomplete chains
  const chainResumeInfo = await getChainResumeInfo(cmRoot);
  if (chainResumeInfo) {
    debug('[getResumeStartIndex] Found chain resume, returning %d', chainResumeInfo.stepIndex);
    return chainResumeInfo.stepIndex;
  }

  // Check notCompletedSteps (crash recovery)
  if (data.notCompletedSteps && data.notCompletedSteps.length > 0) {
    const startIndex = Math.min(...data.notCompletedSteps);
    debug('[getResumeStartIndex] notCompletedSteps=%O, starting at %d', data.notCompletedSteps, startIndex);
    return startIndex;
  }

  // Check completedSteps - if all steps done, start after the last one
  const completedSteps = data.completedSteps as Record<string, StepData>;
  if (completedSteps && typeof completedSteps === 'object') {
    const completedIndices = Object.entries(completedSteps)
      .filter(([, stepData]) => stepData.completedAt !== undefined)
      .map(([key]) => parseInt(key, 10));

    if (completedIndices.length > 0) {
      // Return index after the highest completed step
      return Math.max(...completedIndices) + 1;
    }
  }

  return 0;
}
