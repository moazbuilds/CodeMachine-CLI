import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { PlaceholdersConfig } from './types.js';
import { resolvePackageRoot } from '../../runtime/root.js';

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
      return {};
    }

    const configPath = path.join(packageRoot, 'config', 'placeholders.js');

    if (!existsSync(configPath)) {
      console.warn(`Warning: Placeholder config not found at ${configPath}`);
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
      return config as PlaceholdersConfig;
    } else {
      // Backwards compatibility: treat flat config as userDir
      return { userDir: config };
    }
  } catch (error) {
    console.warn(`Warning: Failed to load placeholder config: ${error instanceof Error ? error.message : String(error)}`);
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
  const loadedConfig = config || loadPlaceholdersConfig();
  const packageRoot = getPackageRoot();

  // Check userDir first, then packageDir
  if (loadedConfig.userDir && loadedConfig.userDir[placeholderName]) {
    return {
      filePath: loadedConfig.userDir[placeholderName],
      baseDir: cwd,
    };
  }

  if (loadedConfig.packageDir && loadedConfig.packageDir[placeholderName]) {
    return {
      filePath: loadedConfig.packageDir[placeholderName],
      baseDir: packageRoot || cwd,
    };
  }

  return null;
}
