/**
 * Manifest parsing and validation for CodeMachine imports
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ImportManifest, ValidationResult } from './types.js';

const MANIFEST_FILENAME = 'codemachine.json';
const LOCAL_MANIFEST_FILENAME = '.codemachine.json';

/**
 * Default paths following CodeMachine conventions
 */
const DEFAULT_PATHS = {
  config: 'config',
  workflows: 'templates/workflows',
  prompts: 'prompts',
  characters: 'config/agent-characters.json',
};

/**
 * Find the manifest file path (checks both codemachine.json and .codemachine.json)
 */
export function findManifestPath(importPath: string): string | null {
  // Check for .codemachine.json first (local imports)
  const localManifestPath = join(importPath, LOCAL_MANIFEST_FILENAME);
  if (existsSync(localManifestPath)) {
    return localManifestPath;
  }

  // Check for codemachine.json (standard imports)
  const manifestPath = join(importPath, MANIFEST_FILENAME);
  if (existsSync(manifestPath)) {
    return manifestPath;
  }

  return null;
}

/**
 * Parse a manifest file from a directory
 */
export function parseManifest(importPath: string): ImportManifest | null {
  const manifestPath = findManifestPath(importPath);

  if (!manifestPath) {
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
  characters: string;
} {
  const paths = manifest?.paths ?? {};

  return {
    config: join(importPath, paths.config ?? DEFAULT_PATHS.config),
    workflows: join(importPath, paths.workflows ?? DEFAULT_PATHS.workflows),
    prompts: join(importPath, paths.prompts ?? DEFAULT_PATHS.prompts),
    characters: join(importPath, paths.characters ?? DEFAULT_PATHS.characters),
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
    errors.push(`Missing manifest file (${MANIFEST_FILENAME} or ${LOCAL_MANIFEST_FILENAME})`);
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
 * Get the manifest filename constant
 */
export function getManifestFilename(): string {
  return MANIFEST_FILENAME;
}
