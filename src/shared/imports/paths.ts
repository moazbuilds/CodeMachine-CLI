/**
 * Path resolution for the CodeMachine import system
 */

import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Get the base directory for CodeMachine user data
 * Default: ~/.codemachine/
 */
export function getCodemachineHomeDir(): string {
  const override = process.env.CODEMACHINE_HOME;
  if (override && override.length > 0) return override;
  return join(homedir(), '.codemachine');
}

/**
 * Get the imports directory
 * Default: ~/.codemachine/imports/
 */
export function getImportsDir(): string {
  const override = process.env.CODEMACHINE_IMPORTS_DIR;
  if (override && override.length > 0) return override;
  return join(getCodemachineHomeDir(), 'imports');
}

/**
 * Get the registry file path
 * Default: ~/.codemachine/imports/registry.json
 */
export function getRegistryPath(): string {
  return join(getImportsDir(), 'registry.json');
}

/**
 * Ensure the imports directory exists
 */
export function ensureImportsDir(): string {
  const importsDir = getImportsDir();
  if (!existsSync(importsDir)) {
    mkdirSync(importsDir, { recursive: true });
  }
  return importsDir;
}

/**
 * Get the path where an import would be installed
 */
export function getImportInstallPath(repoName: string): string {
  return join(getImportsDir(), repoName);
}

/**
 * Check if an import is installed by repo name
 */
export function isImportInstalled(repoName: string): boolean {
  const installPath = getImportInstallPath(repoName);
  return existsSync(installPath);
}

/**
 * Get all installed import directories
 */
export function getInstalledImportPaths(): string[] {
  const importsDir = getImportsDir();
  if (!existsSync(importsDir)) {
    return [];
  }

  const entries = readdirSync(importsDir);

  return entries
    .filter((entry) => {
      if (entry === 'registry.json') return false;
      const fullPath = join(importsDir, entry);
      try {
        return statSync(fullPath).isDirectory();
      } catch {
        return false;
      }
    })
    .map((entry) => join(importsDir, entry));
}
