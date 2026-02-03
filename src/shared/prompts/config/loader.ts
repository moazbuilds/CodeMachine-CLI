import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { PlaceholdersConfig } from './types.js';
import { getDevRoot } from '../../runtime/dev.js';
import { debug } from '../../logging/logger.js';
import { getAllInstalledImports } from '../../imports/index.js';

const require = createRequire(import.meta.url);

function getPackageRoot(): string | null {
  return getDevRoot();
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
 * Loads a placeholder config from a specific directory
 * Returns null if no config exists at that path
 */
function loadPlaceholderConfigFromPath(configPath: string): PlaceholdersConfig | null {
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
      // Backwards compatibility: treat flat config as packageDir for imports
      return { packageDir: config };
    }
  } catch {
    return null;
  }
}

/**
 * Resolves a placeholder name to its file path and base directory
 * Returns null if the placeholder is not defined in the config
 *
 * Resolution order:
 * 1. userDir (local project overrides)
 * 2. Imported packages' configs (imports take precedence)
 * 3. Main package's packageDir
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

  // 1. Check userDir first (local project overrides)
  if (loadedConfig.userDir && loadedConfig.userDir[placeholderName]) {
    const result = {
      filePath: loadedConfig.userDir[placeholderName],
      baseDir: cwd,
    };
    debug('[PLACEHOLDER-CONFIG] "%s" -> FOUND in userDir: %s (baseDir: %s)', placeholderName, result.filePath, result.baseDir);
    return result;
  }
  debug('[PLACEHOLDER-CONFIG] "%s" -> NOT in userDir', placeholderName);

  // 2. Check imported packages (they take precedence over main package)
  const imports = getAllInstalledImports();
  debug('[PLACEHOLDER-CONFIG] Found %d installed imports: %s',
    imports.length,
    imports.map(i => `${i.name}@${i.path}`).join(', ') || '(none)'
  );
  for (const imp of imports) {
    const importConfigPath = path.join(imp.path, 'config', 'placeholders.js');
    debug('[PLACEHOLDER-CONFIG] Checking import "%s" config at: %s', imp.name, importConfigPath);
    const importConfig = loadPlaceholderConfigFromPath(importConfigPath);
    debug('[PLACEHOLDER-CONFIG] Import "%s" config loaded: userDir=%d, packageDir=%d',
      imp.name,
      importConfig?.userDir ? Object.keys(importConfig.userDir).length : 0,
      importConfig?.packageDir ? Object.keys(importConfig.packageDir).length : 0
    );

    if (importConfig) {
      // Check import's userDir (resolved relative to cwd, not import path)
      if (importConfig.userDir && importConfig.userDir[placeholderName]) {
        const result = {
          filePath: importConfig.userDir[placeholderName],
          baseDir: cwd,  // userDir resolves relative to working directory
        };
        debug('[PLACEHOLDER-CONFIG] "%s" -> FOUND in import "%s" userDir: %s (baseDir: %s)',
          placeholderName, imp.name, result.filePath, result.baseDir);
        return result;
      }

      // Check import's packageDir
      if (importConfig.packageDir && importConfig.packageDir[placeholderName]) {
        const result = {
          filePath: importConfig.packageDir[placeholderName],
          baseDir: imp.path,
        };
        debug('[PLACEHOLDER-CONFIG] "%s" -> FOUND in import "%s" packageDir: %s (baseDir: %s)',
          placeholderName, imp.name, result.filePath, result.baseDir);
        return result;
      }
    }
  }
  debug('[PLACEHOLDER-CONFIG] "%s" -> NOT in any imports', placeholderName);

  // 3. Check main package's packageDir
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
