/**
 * Registry management for installed CodeMachine imports
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { ImportRegistry, InstalledImport, ImportManifest } from './types.js';
import { getRegistryPath, ensureImportsDir, getImportInstallPath } from './paths.js';
import { getResolvedPaths } from './manifest.js';

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Load the import registry
 */
export function loadRegistry(): ImportRegistry {
  const registryPath = getRegistryPath();

  if (!existsSync(registryPath)) {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      imports: {},
    };
  }

  try {
    const content = readFileSync(registryPath, 'utf8');
    const parsed = JSON.parse(content) as ImportRegistry;

    // Handle schema migrations if needed
    if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      // Future: migrate schema here
    }

    return parsed;
  } catch {
    // Corrupted registry, start fresh
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      imports: {},
    };
  }
}

/**
 * Save the import registry
 */
export function saveRegistry(registry: ImportRegistry): void {
  ensureImportsDir();
  const registryPath = getRegistryPath();
  writeFileSync(registryPath, JSON.stringify(registry, null, 2));
}

/**
 * Register an installed import
 */
export function registerImport(
  repoName: string,
  manifest: ImportManifest,
  source: string
): InstalledImport {
  const registry = loadRegistry();
  const installPath = getImportInstallPath(repoName);
  const resolvedPaths = getResolvedPaths(installPath, manifest);

  const installedImport: InstalledImport = {
    name: manifest.name,
    version: manifest.version,
    source,
    path: installPath,
    installedAt: new Date().toISOString(),
    resolvedPaths,
  };

  registry.imports[manifest.name] = installedImport;
  saveRegistry(registry);

  return installedImport;
}

/**
 * Unregister an import
 */
export function unregisterImport(name: string): boolean {
  const registry = loadRegistry();

  if (!registry.imports[name]) {
    return false;
  }

  delete registry.imports[name];
  saveRegistry(registry);
  return true;
}

/**
 * Get an installed import by name
 */
export function getInstalledImport(name: string): InstalledImport | undefined {
  const registry = loadRegistry();
  return registry.imports[name];
}

/**
 * Get all installed imports
 */
export function getAllInstalledImports(): InstalledImport[] {
  const registry = loadRegistry();
  return Object.values(registry.imports);
}

/**
 * Check if an import is registered by name
 */
export function isImportRegistered(name: string): boolean {
  const registry = loadRegistry();
  return name in registry.imports;
}

/**
 * Get all registered import root paths (for agent/workflow discovery)
 */
export function getImportRoots(): string[] {
  const imports = getAllInstalledImports();
  return imports.map((imp) => imp.path);
}

/**
 * Import root with metadata for namespacing
 */
export interface ImportRootWithMetadata {
  path: string;
  packageName: string;
}

/**
 * Get all registered import roots with package name metadata
 * Used for namespacing agent/module/character IDs from imports
 */
export function getImportRootsWithMetadata(): ImportRootWithMetadata[] {
  const imports = getAllInstalledImports();
  return imports.map((imp) => ({
    path: imp.path,
    packageName: imp.name,
  }));
}

/**
 * Build a map from import path to package name for quick lookups
 */
export function buildImportPathToNameMap(): Map<string, string> {
  const imports = getAllInstalledImports();
  const map = new Map<string, string>();
  for (const imp of imports) {
    map.set(imp.path, imp.name);
  }
  return map;
}
