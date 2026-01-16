import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { resolvePackageRoot } from '../runtime/root.js';
import { debug } from '../logging/logger.js';

const TEMPLATE_TRACKING_FILE = 'template.json';

const packageRoot = resolvePackageRoot(import.meta.url, 'workflows template tracking');

const templatesDir = path.resolve(packageRoot, 'templates', 'workflows');

/**
 * Data stored for each workflow step
 */
export interface StepData {
  /** Session ID for resuming the agent conversation */
  sessionId: string;
  /** Monitoring ID for log file access */
  monitoringId: number;
  /** Completed chain indices (only present while step has incomplete chains) */
  completedChains?: number[];
  /** ISO timestamp when step fully completed (presence indicates step is done) */
  completedAt?: string;
}

/**
 * Controller configuration for autonomous mode
 * Note: engine/model are NOT persisted here - read from MonitorService instead
 */
export interface ControllerConfig {
  agentId: string;
  sessionId: string;
  monitoringId: number;
}

interface TemplateTracking {
  activeTemplate: string;
  /**
   * Timestamp in ISO 8601 format with UTC timezone (e.g., "2025-10-13T14:40:14.123Z").
   * The "Z" suffix explicitly indicates UTC timezone.
   * To convert to local time in JavaScript: new Date(lastUpdated).toLocaleString()
   */
  lastUpdated: string;
  /** Step data indexed by step number as string (e.g., "0", "1", "2") */
  completedSteps?: Record<string, StepData>;
  notCompletedSteps?: number[];
  resumeFromLastStep?: boolean;
  selectedTrack?: string; // Selected workflow track (e.g., 'bmad', 'quick', 'enterprise')
  selectedConditions?: string[]; // Selected conditions (e.g., ['has_ui', 'has_api'])
  projectName?: string; // User-provided project name for placeholder replacement
  autonomousMode?: string; // 'true' | 'false' | 'never' | 'always'
  controllerConfig?: ControllerConfig; // Controller agent config for autonomous mode
  controllerView?: boolean; // If true, recovery opens controller view; if false, shows normal workflow view
}

/**
 * Gets the currently active template name from the tracking file.
 */
export async function getActiveTemplate(cmRoot: string): Promise<string | null> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);
  debug('[Template] getActiveTemplate: trackingPath=%s', trackingPath);

  if (!existsSync(trackingPath)) {
    debug('[Template] getActiveTemplate: file does not exist, returning null');
    return null;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    debug('[Template] getActiveTemplate: activeTemplate=%s', data.activeTemplate);
    return data.activeTemplate ?? null;
  } catch (error) {
    debug('[Template] getActiveTemplate: parse error=%s', error instanceof Error ? error.message : String(error));
    console.warn(`Failed to read active template from tracking file: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Sets the active template name in the tracking file.
 * Preserves existing step data if the template is the same.
 */
export async function setActiveTemplate(cmRoot: string, templateName: string, autonomousModeOverride?: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  let data: TemplateTracking;

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8');
      const existing = JSON.parse(content) as TemplateTracking;

      // If same template, preserve existing data (for resume capability)
      if (existing.activeTemplate === templateName) {
        data = {
          ...existing,
          lastUpdated: new Date().toISOString(),
        };
      } else {
        // Different template - reset step tracking
        data = {
          activeTemplate: templateName,
          lastUpdated: new Date().toISOString(),
          completedSteps: {},
          notCompletedSteps: [],
          resumeFromLastStep: true,
          autonomousMode: autonomousModeOverride ?? 'true', // Use template override or default to 'true'
          // Preserve user preferences
          selectedTrack: existing.selectedTrack,
          selectedConditions: existing.selectedConditions,
          projectName: existing.projectName,
        };
      }
    } catch {
      // File exists but failed to parse - create fresh
      data = {
        activeTemplate: templateName,
        lastUpdated: new Date().toISOString(),
        completedSteps: {},
        notCompletedSteps: [],
        resumeFromLastStep: true,
        autonomousMode: autonomousModeOverride ?? 'true',
      };
    }
  } else {
    // No existing file - create fresh
    data = {
      activeTemplate: templateName,
      lastUpdated: new Date().toISOString(),
      completedSteps: {},
      notCompletedSteps: [],
      resumeFromLastStep: true,
      autonomousMode: autonomousModeOverride ?? 'true',
    };
  }

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Checks if the provided template is different from the currently active one.
 * Returns true if:
 * - There is an active template and it's different from the provided one
 * - There is no active template but we have a new one (first run with template)
 */
export async function hasTemplateChanged(cmRoot: string, templateName: string): Promise<boolean> {
  const activeTemplate = await getActiveTemplate(cmRoot);

  // If no active template, treat it as changed (first run with template should regenerate)
  if (activeTemplate === null) {
    return true;
  }

  // Check if the template is different
  return activeTemplate !== templateName;
}

/**
 * Gets the full template path from the tracking file.
 * Returns the default template if no template is tracked.
 */
export async function getTemplatePathFromTracking(cmRoot: string): Promise<string> {
  const activeTemplate = await getActiveTemplate(cmRoot);

  if (!activeTemplate) {
    // No template tracked, return default
    return path.join(templatesDir, 'bmad.workflow.js');
  }

  // Return full path from template name
  return path.join(templatesDir, activeTemplate);
}

/**
 * Gets the selected track from the tracking file.
 */
export async function getSelectedTrack(cmRoot: string): Promise<string | null> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);
  debug('[Template] getSelectedTrack: trackingPath=%s', trackingPath);

  if (!existsSync(trackingPath)) {
    debug('[Template] getSelectedTrack: file does not exist, returning null');
    return null;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    debug('[Template] getSelectedTrack: selectedTrack=%s', data.selectedTrack);
    return data.selectedTrack ?? null;
  } catch (error) {
    debug('[Template] getSelectedTrack: parse error=%s', error instanceof Error ? error.message : String(error));
    console.warn(`Failed to read selected track: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Sets the selected track in the tracking file.
 */
export async function setSelectedTrack(cmRoot: string, track: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  let data: TemplateTracking;

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8');
      data = JSON.parse(content) as TemplateTracking;
    } catch {
      data = {
        activeTemplate: '',
        lastUpdated: new Date().toISOString(),
        completedSteps: {},
        notCompletedSteps: [],
        resumeFromLastStep: true,
      };
    }
  } else {
    data = {
      activeTemplate: '',
      lastUpdated: new Date().toISOString(),
      completedSteps: {},
      notCompletedSteps: [],
      resumeFromLastStep: true,
    };
  }

  data.selectedTrack = track;
  data.lastUpdated = new Date().toISOString();

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Gets the selected conditions from the tracking file.
 */
export async function getSelectedConditions(cmRoot: string): Promise<string[]> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);
  debug('[Template] getSelectedConditions: trackingPath=%s', trackingPath);

  if (!existsSync(trackingPath)) {
    debug('[Template] getSelectedConditions: file does not exist, returning []');
    return [];
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    debug('[Template] getSelectedConditions: selectedConditions=%O', data.selectedConditions);
    return data.selectedConditions ?? [];
  } catch (error) {
    debug('[Template] getSelectedConditions: parse error=%s', error instanceof Error ? error.message : String(error));
    console.warn(`Failed to read selected conditions: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Checks if conditions have been selected (key exists in template.json).
 * Returns true if user has gone through onboard and made a selection (even if empty).
 */
export async function hasSelectedConditions(cmRoot: string): Promise<boolean> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return false;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    return data.selectedConditions !== undefined;
  } catch {
    return false;
  }
}

/**
 * Sets the selected conditions in the tracking file.
 */
export async function setSelectedConditions(cmRoot: string, conditions: string[]): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  let data: TemplateTracking;

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8');
      data = JSON.parse(content) as TemplateTracking;
    } catch {
      data = {
        activeTemplate: '',
        lastUpdated: new Date().toISOString(),
        completedSteps: {},
        notCompletedSteps: [],
        resumeFromLastStep: true,
      };
    }
  } else {
    data = {
      activeTemplate: '',
      lastUpdated: new Date().toISOString(),
      completedSteps: {},
      notCompletedSteps: [],
      resumeFromLastStep: true,
    };
  }

  data.selectedConditions = conditions;
  data.lastUpdated = new Date().toISOString();

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Gets the project name from the tracking file.
 */
export async function getProjectName(cmRoot: string): Promise<string | null> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);
  debug('[Template] getProjectName: trackingPath=%s', trackingPath);

  if (!existsSync(trackingPath)) {
    debug('[Template] getProjectName: file does not exist, returning null');
    return null;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    debug('[Template] getProjectName: projectName=%s', data.projectName);
    return data.projectName ?? null;
  } catch (error) {
    debug('[Template] getProjectName: parse error=%s', error instanceof Error ? error.message : String(error));
    console.warn(`Failed to read project name: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Sets the project name in the tracking file.
 */
export async function setProjectName(cmRoot: string, projectName: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  let data: TemplateTracking;

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8');
      data = JSON.parse(content) as TemplateTracking;
    } catch {
      data = {
        activeTemplate: '',
        lastUpdated: new Date().toISOString(),
        completedSteps: {},
        notCompletedSteps: [],
        resumeFromLastStep: true,
      };
    }
  } else {
    data = {
      activeTemplate: '',
      lastUpdated: new Date().toISOString(),
      completedSteps: {},
      notCompletedSteps: [],
      resumeFromLastStep: true,
    };
  }

  data.projectName = projectName;
  data.lastUpdated = new Date().toISOString();

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Gets the controller view setting from the tracking file.
 * Returns true if recovery should open controller view, false for normal workflow view.
 */
export async function getControllerView(cmRoot: string): Promise<boolean> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);
  debug('[Template] getControllerView: trackingPath=%s', trackingPath);

  if (!existsSync(trackingPath)) {
    debug('[Template] getControllerView: file does not exist, returning false');
    return false;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    debug('[Template] getControllerView: controllerView=%s', data.controllerView);
    return data.controllerView ?? false;
  } catch (error) {
    debug('[Template] getControllerView: parse error=%s', error instanceof Error ? error.message : String(error));
    console.warn(`Failed to read controller view: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Sets the controller view setting in the tracking file.
 */
export async function setControllerView(cmRoot: string, controllerView: boolean): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  let data: TemplateTracking;

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8');
      data = JSON.parse(content) as TemplateTracking;
    } catch {
      data = {
        activeTemplate: '',
        lastUpdated: new Date().toISOString(),
        completedSteps: {},
        notCompletedSteps: [],
        resumeFromLastStep: true,
      };
    }
  } else {
    data = {
      activeTemplate: '',
      lastUpdated: new Date().toISOString(),
      completedSteps: {},
      notCompletedSteps: [],
      resumeFromLastStep: true,
    };
  }

  data.controllerView = controllerView;
  data.lastUpdated = new Date().toISOString();

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}
