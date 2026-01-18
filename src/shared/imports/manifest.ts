/**
 * Manifest parsing and validation for CodeMachine imports
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ImportManifest, ValidationResult } from './types.js';

const MANIFEST_FILENAME = 'codemachine.json';
const REQUIRED_SUFFIX = '-codemachine';

/**
 * Default paths following CodeMachine conventions
 */
const DEFAULT_PATHS = {
  config: 'config',
  workflows: 'templates/workflows',
  prompts: 'prompts',
};

/**
 * Parse a manifest file from a directory
 */
export function parseManifest(importPath: string): ImportManifest | null {
  const manifestPath = join(importPath, MANIFEST_FILENAME);

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(content);
    return parsed as ImportManifest;
  } catch {
    return null;
  }
}

/**
 * Get resolved paths for an import (applies defaults and overrides)
 */
export function getResolvedPaths(importPath: string, manifest?: ImportManifest | null): {
  config: string;
  workflows: string;
  prompts: string;
} {
  const paths = manifest?.paths ?? {};

  return {
    config: join(importPath, paths.config ?? DEFAULT_PATHS.config),
    workflows: join(importPath, paths.workflows ?? DEFAULT_PATHS.workflows),
    prompts: join(importPath, paths.prompts ?? DEFAULT_PATHS.prompts),
  };
}

/**
 * Validate an import directory
 */
export function validateImport(importPath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check manifest exists
  const manifest = parseManifest(importPath);
  if (!manifest) {
    errors.push(`Missing ${MANIFEST_FILENAME} file`);
    return { valid: false, errors, warnings };
  }

  // Check required manifest fields
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('Manifest missing required "name" field');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Manifest missing required "version" field');
  }

  // Get resolved paths
  const paths = getResolvedPaths(importPath, manifest);

  // Check required directories/files
  if (!existsSync(paths.config)) {
    errors.push(`Missing config directory: ${paths.config}`);
  } else {
    // Check for main.agents.js
    const mainAgentsPath = join(paths.config, 'main.agents.js');
    if (!existsSync(mainAgentsPath)) {
      errors.push(`Missing required file: config/main.agents.js`);
    }
  }

  if (!existsSync(paths.workflows)) {
    errors.push(`Missing workflows directory: ${paths.workflows}`);
  } else {
    // Check for at least one workflow file
    const workflowFiles = readdirSync(paths.workflows).filter(
      (f) => f.endsWith('.workflow.js')
    );
    if (workflowFiles.length === 0) {
      errors.push('No .workflow.js files found in workflows directory');
    }
  }

  if (!existsSync(paths.prompts)) {
    warnings.push(`Missing prompts directory: ${paths.prompts}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest,
  };
}

/**
 * Check if a repo name follows the -codemachine suffix convention
 */
export function hasValidSuffix(repoName: string): boolean {
  return repoName.endsWith(REQUIRED_SUFFIX);
}

/**
 * Get the manifest filename constant
 */
export function getManifestFilename(): string {
  return MANIFEST_FILENAME;
}

/**
 * Get the required suffix constant
 */
export function getRequiredSuffix(): string {
  return REQUIRED_SUFFIX;
}
