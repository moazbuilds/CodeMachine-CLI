/**
 * Built-in dynamic placeholders that are injected at runtime
 * without file lookup
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const CM_FOLDER = '.codemachine';
const TEMPLATE_FILE = 'template.json';

// Static placeholders (no context needed)
const STATIC_PLACEHOLDERS: Record<string, () => string> = {
  date: () => new Date().toISOString().split('T')[0], // YYYY-MM-DD
  datetime: () => new Date().toISOString(),
  timestamp: () => Date.now().toString(),
  user_name: () => os.userInfo().username,
};

// Context-dependent placeholders (loaded from template.json)
const CONTEXT_PLACEHOLDERS = ['project_name', 'selected_track', 'selected_conditions'] as const;

/**
 * Gets built-in placeholder content.
 * For static placeholders (date, datetime, timestamp), returns value immediately.
 * For context placeholders (project_name), loads from template.json.
 */
export async function getBuiltInContent(
  name: string,
  cwd: string,
): Promise<string | null> {
  // Check static placeholders first
  const staticGenerator = STATIC_PLACEHOLDERS[name];
  if (staticGenerator) {
    return staticGenerator();
  }

  // Check context-dependent placeholders
  if (name === 'project_name') {
    return loadProjectName(cwd);
  }

  if (name === 'selected_track') {
    return loadSelectedTrack(cwd);
  }

  if (name === 'selected_conditions') {
    return loadSelectedConditions(cwd);
  }

  return null;
}

/**
 * Checks if a placeholder name is a built-in placeholder.
 */
export function isBuiltInPlaceholder(name: string): boolean {
  return name in STATIC_PLACEHOLDERS || CONTEXT_PLACEHOLDERS.includes(name as typeof CONTEXT_PLACEHOLDERS[number]);
}

/**
 * Loads template.json data
 */
async function loadTemplateData(cwd: string): Promise<Record<string, unknown> | null> {
  const templatePath = path.join(cwd, CM_FOLDER, TEMPLATE_FILE);

  if (!existsSync(templatePath)) {
    return null;
  }

  try {
    const content = await readFile(templatePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Loads project name from template.json
 */
async function loadProjectName(cwd: string): Promise<string | null> {
  const data = await loadTemplateData(cwd);
  return (data?.projectName as string) ?? null;
}

/**
 * Loads selected track from template.json
 */
async function loadSelectedTrack(cwd: string): Promise<string | null> {
  const data = await loadTemplateData(cwd);
  return (data?.selectedTrack as string) ?? null;
}

/**
 * Loads selected conditions from template.json
 * Returns comma-separated string
 */
async function loadSelectedConditions(cwd: string): Promise<string | null> {
  const data = await loadTemplateData(cwd);
  const conditions = data?.selectedConditions as string[] | undefined;
  if (!conditions || conditions.length === 0) {
    return null;
  }
  return conditions.join(', ');
}
