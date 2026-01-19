import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { PlaceholdersConfig } from './types.js';
import { resolvePackageRoot } from '../../runtime/root.js';
import { getAllInstalledImports } from '../../imports/index.js';

const require = createRequire(import.meta.url);

function getPackageRoot(): string | null {
  try {
    return resolvePackageRoot(import.meta.url, 'prompts config loader');
  } catch {
    return null;
  }
}

/**
 * Extended config that includes imported placeholders with their base directories
 */
export interface ExtendedPlaceholdersConfig extends PlaceholdersConfig {
  /** Imported placeholders keyed by namespaced name: { 'bmad:plan_fallback': { path: '...', baseDir: '...' } } */
  imported?: Record<string, { filePath: string; baseDir: string }>;
}

let cachedConfig: ExtendedPlaceholdersConfig | null = null;

/**
 * Loads placeholder config from a single path
 */
function loadConfigFromPath(configPath: string): PlaceholdersConfig | null {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    // Clear cache to allow dynamic reloading
    try {
      delete require.cache[require.resolve(configPath)];
    } catch {
      // Ignore if not in cache
    }

    const config = require(configPath);

    // Support both old format (flat) and new format (userDir/packageDir)
    if (config.userDir || config.packageDir) {
      return config as PlaceholdersConfig;
    } else {
      // Backwards compatibility: treat flat config as userDir
      return { userDir: config };
    }
  } catch {
    return null;
  }
}

/**
 * Loads the prompt placeholders configuration
 * Includes placeholders from imported packages with namespaced names
 */
export function loadPlaceholdersConfig(): ExtendedPlaceholdersConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const config: ExtendedPlaceholdersConfig = {};

  try {
    const packageRoot = getPackageRoot();
    if (!packageRoot) {
      console.warn('Warning: Could not find codemachine package root');
    } else {
      const configPath = path.join(packageRoot, 'config', 'placeholders.js');
      const localConfig = loadConfigFromPath(configPath);
      if (localConfig) {
        config.userDir = localConfig.userDir;
        config.packageDir = localConfig.packageDir;
      }
    }

    // Load placeholders from imported packages with namespacing
    config.imported = {};
    try {
      const imports = getAllInstalledImports();
      for (const imp of imports) {
        const importConfigPath = path.join(imp.path, 'config', 'placeholders.js');
        const importConfig = loadConfigFromPath(importConfigPath);
        if (importConfig) {
          // Namespace placeholders from packageDir
          if (importConfig.packageDir) {
            for (const [name, filePath] of Object.entries(importConfig.packageDir)) {
              const namespacedName = `${imp.name}:${name}`;
              config.imported[namespacedName] = {
                filePath,
                baseDir: imp.path,
              };
            }
          }
          // Namespace placeholders from userDir (treat as package-relative)
          if (importConfig.userDir) {
            for (const [name, filePath] of Object.entries(importConfig.userDir)) {
              const namespacedName = `${imp.name}:${name}`;
              config.imported[namespacedName] = {
                filePath,
                baseDir: imp.path,
              };
            }
          }
        }
      }
    } catch {
      // Silently ignore import errors - may not have imports system initialized
    }
  } catch (error) {
    console.warn(`Warning: Failed to load placeholder config: ${error instanceof Error ? error.message : String(error)}`);
  }

  cachedConfig = config;
  return config;
}

/**
 * Clears the cached placeholder config (useful for testing or hot reload)
 */
export function clearPlaceholdersCache(): void {
  cachedConfig = null;
}

/**
 * Resolves a placeholder name to its file path and base directory
 * Returns null if the placeholder is not defined in the config
 *
 * Resolution order:
 * 1. Local userDir placeholders
 * 2. Local packageDir placeholders
 * 3. Imported placeholders (namespaced, e.g., 'bmad:plan_fallback')
 */
export function resolvePlaceholderPath(
  placeholderName: string,
  cwd: string,
  config?: ExtendedPlaceholdersConfig
): { filePath: string; baseDir: string } | null {
  const loadedConfig = config || loadPlaceholdersConfig();
  const packageRoot = getPackageRoot();

  // Check userDir first (local project placeholders)
  if (loadedConfig.userDir && loadedConfig.userDir[placeholderName]) {
    return {
      filePath: loadedConfig.userDir[placeholderName],
      baseDir: cwd,
    };
  }

  // Check packageDir (codemachine package placeholders)
  if (loadedConfig.packageDir && loadedConfig.packageDir[placeholderName]) {
    return {
      filePath: loadedConfig.packageDir[placeholderName],
      baseDir: packageRoot || cwd,
    };
  }

  // Check imported placeholders (namespaced, e.g., 'bmad:plan_fallback')
  if (loadedConfig.imported && loadedConfig.imported[placeholderName]) {
    return loadedConfig.imported[placeholderName];
  }

  return null;
}
