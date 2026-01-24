import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { PlaceholdersConfig } from './types.js';
import { resolvePackageRoot } from '../../runtime/root.js';
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
 * Loads the prompt placeholders configuration
 */
export function loadPlaceholdersConfig(): PlaceholdersConfig {
  try {
    const packageRoot = getPackageRoot();
    if (!packageRoot) {
      console.warn('Warning: Could not find codemachine package root');
      debug('[PLACEHOLDER-CONFIG] WARNING: Could not find package root');
      return {};
    }

    const configPath = path.join(packageRoot, 'config', 'placeholders.js');
    debug('[PLACEHOLDER-CONFIG] Loading config from: %s', configPath);

    if (!existsSync(configPath)) {
      console.warn(`Warning: Placeholder config not found at ${configPath}`);
      debug('[PLACEHOLDER-CONFIG] Config file does not exist');
      return {};
    }

    // Clear cache to allow dynamic reloading
    try {
      delete require.cache[require.resolve(configPath)];
    } catch {
      // Ignore if not in cache
    }

    const config = require(configPath);

    // Support both old format (flat) and new format (userDir/packageDir)
    if (config.userDir || config.packageDir) {
      debug('[PLACEHOLDER-CONFIG] Loaded config: userDir=%d, packageDir=%d',
        Object.keys(config.userDir || {}).length,
        Object.keys(config.packageDir || {}).length
      );
      return config as PlaceholdersConfig;
    } else {
      // Backwards compatibility: treat flat config as userDir
      debug('[PLACEHOLDER-CONFIG] Loaded flat config as userDir: %d placeholders',
        Object.keys(config).length
      );
      return { userDir: config };
    }
  } catch (error) {
    console.warn(`Warning: Failed to load placeholder config: ${error instanceof Error ? error.message : String(error)}`);
    debug('[PLACEHOLDER-CONFIG] ERROR loading config: %s', (error as Error).message);
    return {};
  }
}

/**
 * Resolves a placeholder name to its file path and base directory
 * Returns null if the placeholder is not defined in the config
 */
export function resolvePlaceholderPath(
  placeholderName: string,
  cwd: string,
  config?: PlaceholdersConfig
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

  // Check userDir first, then packageDir
  if (loadedConfig.userDir && loadedConfig.userDir[placeholderName]) {
    const result = {
      filePath: loadedConfig.userDir[placeholderName],
      baseDir: cwd,
    };
    debug('[PLACEHOLDER-CONFIG] "%s" -> FOUND in userDir: %s (baseDir: %s)', placeholderName, result.filePath, result.baseDir);
    return result;
  }
  debug('[PLACEHOLDER-CONFIG] "%s" -> NOT in userDir', placeholderName);

  if (loadedConfig.packageDir && loadedConfig.packageDir[placeholderName]) {
    const result = {
      filePath: loadedConfig.packageDir[placeholderName],
      baseDir: packageRoot || cwd,
    };
    debug('[PLACEHOLDER-CONFIG] "%s" -> FOUND in packageDir: %s (baseDir: %s)', placeholderName, result.filePath, result.baseDir);
    return result;
  }
  debug('[PLACEHOLDER-CONFIG] "%s" -> NOT in packageDir', placeholderName);

  debug('[PLACEHOLDER-CONFIG] "%s" -> NOT FOUND in config', placeholderName);
  return null;
}
