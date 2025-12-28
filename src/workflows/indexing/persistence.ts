/**
 * Step Indexing Persistence
 *
 * Handles all file I/O for step indexing data in template.json.
 * This is the only module that directly reads/writes the tracking file.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { StepData, TemplateTracking } from './types.js';
import { logPersistence, logDebug } from './debug.js';

const TEMPLATE_TRACKING_FILE = 'template.json';

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
function migrateCompletedSteps(
  completedSteps: Record<string, StepData> | number[] | undefined
): Record<string, StepData> {
  if (Array.isArray(completedSteps)) {
    logDebug('migration', 'Migrating old array format to Record format', {
      oldFormat: completedSteps,
    });
    const newSteps: Record<string, StepData> = {};
    for (const idx of completedSteps) {
      newSteps[String(idx)] = {
        sessionId: '',
        monitoringId: 0,
        completedAt: new Date().toISOString(),
      };
    }
    return newSteps;
  }
  return completedSteps ?? {};
}

/**
 * Reads and migrates template tracking data
 */
export async function readTrackingData(
  cmRoot: string
): Promise<{ data: TemplateTracking; trackingPath: string }> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);
  logPersistence('READ', trackingPath);

  if (!existsSync(trackingPath)) {
    logDebug('persistence', 'File does not exist, returning defaults');
    return { data: createDefaultData(), trackingPath };
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking & {
      completedSteps?: Record<string, StepData> | number[];
    };

    // Migrate old format if needed
    data.completedSteps = migrateCompletedSteps(data.completedSteps);

    logDebug('persistence', 'Read complete', {
      activeTemplate: data.activeTemplate,
      completedStepsCount: Object.keys(data.completedSteps).length,
      notCompletedStepsCount: data.notCompletedSteps?.length ?? 0,
      resumeFromLastStep: data.resumeFromLastStep,
    });

    return { data: data as TemplateTracking, trackingPath };
  } catch (error) {
    logDebug('persistence', 'Parse error, returning defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.warn(
      `Failed to read tracking file: ${error instanceof Error ? error.message : String(error)}`
    );
    return { data: createDefaultData(), trackingPath };
  }
}

/**
 * Writes template tracking data
 */
export async function writeTrackingData(
  trackingPath: string,
  data: TemplateTracking
): Promise<void> {
  data.lastUpdated = new Date().toISOString();
  logPersistence('WRITE', {
    path: trackingPath,
    completedStepsCount: Object.keys(data.completedSteps ?? {}).length,
    notCompletedStepsCount: data.notCompletedSteps?.length ?? 0,
  });
  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Gets the tracking file path for a given cmRoot
 */
export function getTrackingPath(cmRoot: string): string {
  return path.join(cmRoot, TEMPLATE_TRACKING_FILE);
}
