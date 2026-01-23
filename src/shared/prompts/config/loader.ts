import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { PlaceholdersConfig } from './types.js';
import { resolvePackageRoot } from '../../runtime/root.js';
import { getAllInstalledImports } from '../../imports/index.js';
import { debug } from '../../logging/logger.js';

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
    debug('[PLACEHOLDER-CONFIG] Using cached config');
    return cachedConfig;
  }

  debug('[PLACEHOLDER-CONFIG] Loading placeholders config (not cached)');
  const config: ExtendedPlaceholdersConfig = {};

  try {
    const packageRoot = getPackageRoot();
    if (!packageRoot) {
      console.warn('Warning: Could not find codemachine package root');
      debug('[PLACEHOLDER-CONFIG] WARNING: Could not find package root');
    } else {
      const configPath = path.join(packageRoot, 'config', 'placeholders.js');
      debug('[PLACEHOLDER-CONFIG] Loading local config from: %s', configPath);
      const localConfig = loadConfigFromPath(configPath);
      if (localConfig) {
        config.userDir = localConfig.userDir;
        config.packageDir = localConfig.packageDir;
        debug('[PLACEHOLDER-CONFIG] Loaded local config: userDir=%d, packageDir=%d',
          Object.keys(localConfig.userDir || {}).length,
          Object.keys(localConfig.packageDir || {}).length
        );
      } else {
        debug('[PLACEHOLDER-CONFIG] No local config found at: %s', configPath);
      }
    }

    // Load placeholders from imported packages with namespacing
    config.imported = {};
    try {
      const imports = getAllInstalledImports();
      debug('[PLACEHOLDER-CONFIG] Found %d imported packages', imports.length);
      for (const imp of imports) {
        const importConfigPath = path.join(imp.path, 'config', 'placeholders.js');
        debug('[PLACEHOLDER-CONFIG] Checking import "%s" at: %s', imp.name, importConfigPath);
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
              debug('[PLACEHOLDER-CONFIG] Imported placeholder: %s -> %s', namespacedName, filePath);
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
              debug('[PLACEHOLDER-CONFIG] Imported placeholder: %s -> %s', namespacedName, filePath);
            }
          }
        } else {
          debug('[PLACEHOLDER-CONFIG] No placeholders config in import "%s"', imp.name);
        }
      }
    } catch (err) {
      // Silently ignore import errors - may not have imports system initialized
      debug('[PLACEHOLDER-CONFIG] Error loading imports: %s', (err as Error).message);
    }
  } catch (error) {
    console.warn(`Warning: Failed to load placeholder config: ${error instanceof Error ? error.message : String(error)}`);
    debug('[PLACEHOLDER-CONFIG] ERROR loading config: %s', (error as Error).message);
  }

  debug('[PLACEHOLDER-CONFIG] Config loaded: userDir=%d, packageDir=%d, imported=%d',
    Object.keys(config.userDir || {}).length,
    Object.keys(config.packageDir || {}).length,
    Object.keys(config.imported || {}).length
  );

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
  debug('[PLACEHOLDER-CONFIG] resolvePlaceholderPath: name="%s", cwd=%s', placeholderName, cwd);

  const loadedConfig = config || loadPlaceholdersConfig();
  const packageRoot = getPackageRoot();

  debug('[PLACEHOLDER-CONFIG] Available userDir placeholders: %s',
    loadedConfig.userDir ? Object.keys(loadedConfig.userDir).join(', ') : '(none)'
  );
  debug('[PLACEHOLDER-CONFIG] Available packageDir placeholders: %s',
    loadedConfig.packageDir ? Object.keys(loadedConfig.packageDir).join(', ') : '(none)'
  );
  debug('[PLACEHOLDER-CONFIG] Available imported placeholders: %s',
    loadedConfig.imported ? Object.keys(loadedConfig.imported).join(', ') : '(none)'
  );

  // Check userDir first (local project placeholders)
  if (loadedConfig.userDir && loadedConfig.userDir[placeholderName]) {
    const result = {
      filePath: loadedConfig.userDir[placeholderName],
      baseDir: cwd,
    };
    debug('[PLACEHOLDER-CONFIG] "%s" -> FOUND in userDir: %s (baseDir: %s)', placeholderName, result.filePath, result.baseDir);
    return result;
  }
  debug('[PLACEHOLDER-CONFIG] "%s" -> NOT in userDir', placeholderName);

  // Check packageDir (codemachine package placeholders)
  if (loadedConfig.packageDir && loadedConfig.packageDir[placeholderName]) {
    const result = {
      filePath: loadedConfig.packageDir[placeholderName],
      baseDir: packageRoot || cwd,
    };
    debug('[PLACEHOLDER-CONFIG] "%s" -> FOUND in packageDir: %s (baseDir: %s)', placeholderName, result.filePath, result.baseDir);
    return result;
  }
  debug('[PLACEHOLDER-CONFIG] "%s" -> NOT in packageDir', placeholderName);

  // Check imported placeholders (namespaced, e.g., 'bmad:plan_fallback')
  if (loadedConfig.imported && loadedConfig.imported[placeholderName]) {
    const result = loadedConfig.imported[placeholderName];
    debug('[PLACEHOLDER-CONFIG] "%s" -> FOUND in imported: %s (baseDir: %s)', placeholderName, result.filePath, result.baseDir);
    return result;
  }
  debug('[PLACEHOLDER-CONFIG] "%s" -> NOT in imported', placeholderName);

  debug('[PLACEHOLDER-CONFIG] "%s" -> NOT FOUND anywhere in config', placeholderName);
  return null;
}
