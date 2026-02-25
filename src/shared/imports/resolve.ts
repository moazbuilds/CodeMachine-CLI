/**
 * Import-aware path resolution utilities
 *
 * These utilities help resolve paths by checking both local directories
 * and imported packages. Imported packages take precedence.
 */

import { existsSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { getAllInstalledImports } from './registry.js';
import { otel_debug } from '../logging/logger.js';
import { LOGGER_NAMES } from '../logging/otel-logger.js';

/**
 * Resolve a prompt path by checking imported packages first, then local
 * @param relativePath - Relative path like "prompts/templates/foo/bar.md"
 * @param localRoot - Local root directory to check (e.g., packageRoot or cwd)
 * @returns Absolute path to the file, or null if not found
 */
export function resolvePromptPath(relativePath: string, localRoot: string): string | null {
  // If already absolute, just return if exists
  if (isAbsolute(relativePath)) {
    return existsSync(relativePath) ? relativePath : null;
  }

  // Check imported packages first (they take precedence)
  const imports = getAllInstalledImports();
  for (const imp of imports) {
    // Try to map the relative path to the import's structure
    // Prompts are typically at prompts/templates/...
    if (relativePath.startsWith('prompts/')) {
      const subPath = relativePath.replace(/^prompts\//, '');
      const importPath = join(imp.resolvedPaths.prompts, subPath.replace(/^templates\//, ''));
      if (existsSync(importPath)) {
        otel_debug(LOGGER_NAMES.CLI, '[resolve] Found prompt in import %s: %s', [imp.name, importPath]);
        return importPath;
      }
    }

    // Also try direct path from import root
    const directPath = join(imp.path, relativePath);
    if (existsSync(directPath)) {
      otel_debug(LOGGER_NAMES.CLI, '[resolve] Found path in import %s (direct): %s', [imp.name, directPath]);
      return directPath;
    }
  }

  // Check local root
  const localPath = resolve(localRoot, relativePath);
  if (existsSync(localPath)) {
    return localPath;
  }

  return null;
}

/**
 * Resolve a prompt folder path by checking imported packages first, then local
 * @param folderName - Folder name like "bmad" (will look in prompts/templates/bmad)
 * @param localRoot - Local root directory to check
 * @returns Absolute path to the folder, or null if not found
 */
export function resolvePromptFolder(folderName: string, localRoot: string): string | null {
  // Check imported packages first (they take precedence)
  const imports = getAllInstalledImports();
  for (const imp of imports) {
    // Look for folder in import's prompts/templates directory
    const importPath = join(imp.resolvedPaths.prompts, folderName);
    if (existsSync(importPath)) {
      otel_debug(LOGGER_NAMES.CLI, '[resolve] Found prompt folder in import %s: %s', [imp.name, importPath]);
      return importPath;
    }
  }

  // Check local root
  const localPath = resolve(localRoot, 'prompts', 'templates', folderName);
  if (existsSync(localPath)) {
    return localPath;
  }

  return null;
}

/**
 * Resolve a workflow template path by checking imported packages first, then local
 * @param templateName - Template filename like "codemachine-one.workflow.js"
 * @param localRoot - Local root directory to check
 * @returns Absolute path to the template, or null if not found
 */
export function resolveWorkflowTemplate(templateName: string, localRoot: string): string | null {
  // If already absolute, just return if exists
  if (isAbsolute(templateName)) {
    return existsSync(templateName) ? templateName : null;
  }

  // Check imported packages first (they take precedence)
  const imports = getAllInstalledImports();
  for (const imp of imports) {
    const importPath = join(imp.resolvedPaths.workflows, templateName);
    if (existsSync(importPath)) {
      otel_debug(LOGGER_NAMES.CLI, '[resolve] Found workflow template in import %s: %s', [imp.name, importPath]);
      return importPath;
    }
  }

  // Check local root
  const localPath = resolve(localRoot, 'templates', 'workflows', templateName);
  if (existsSync(localPath)) {
    return localPath;
  }

  return null;
}

/**
 * Resolve a path by checking multiple roots including imports
 * Returns the first existing path found
 * @param relativePath - Relative path to resolve
 * @param localRoot - Local root directory
 * @param additionalRoots - Additional roots to check
 * @returns Absolute path if found, null otherwise
 */
export function resolvePathWithImports(
  relativePath: string,
  localRoot: string,
  additionalRoots: string[] = []
): string | null {
  // If already absolute, just return if exists
  if (isAbsolute(relativePath)) {
    return existsSync(relativePath) ? relativePath : null;
  }

  // Check imported packages first (they take precedence)
  const imports = getAllInstalledImports();
  for (const imp of imports) {
    const importPath = join(imp.path, relativePath);
    if (existsSync(importPath)) {
      otel_debug(LOGGER_NAMES.CLI, '[resolve] Found path in import %s: %s', [imp.name, importPath]);
      return importPath;
    }
  }

  // Check additional roots
  for (const root of additionalRoots) {
    const path = resolve(root, relativePath);
    if (existsSync(path)) {
      return path;
    }
  }

  // Check local root
  const localPath = resolve(localRoot, relativePath);
  if (existsSync(localPath)) {
    return localPath;
  }

  return null;
}

/**
 * Get all workflow directories including imports
 * Returns an array of absolute paths to workflow directories
 */
export function getAllWorkflowDirectories(localRoot: string): string[] {
  const dirs: string[] = [];

  // Add imported workflow directories first (they take precedence)
  const imports = getAllInstalledImports();
  for (const imp of imports) {
    if (existsSync(imp.resolvedPaths.workflows)) {
      dirs.push(imp.resolvedPaths.workflows);
    }
  }

  // Add local workflow directory
  const localDir = resolve(localRoot, 'templates', 'workflows');
  if (existsSync(localDir)) {
    dirs.push(localDir);
  }

  return dirs;
}

/**
 * Get all prompt directories including imports
 * Returns an array of absolute paths to prompt directories
 */
export function getAllPromptDirectories(localRoot: string): string[] {
  const dirs: string[] = [];

  // Add imported prompt directories first (they take precedence)
  const imports = getAllInstalledImports();
  for (const imp of imports) {
    if (existsSync(imp.resolvedPaths.prompts)) {
      dirs.push(imp.resolvedPaths.prompts);
    }
  }

  // Add local prompt directory
  const localDir = resolve(localRoot, 'prompts', 'templates');
  if (existsSync(localDir)) {
    dirs.push(localDir);
  }

  return dirs;
}
