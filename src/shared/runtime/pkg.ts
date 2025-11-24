import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePackageRoot as resolveRoot } from './root.js';

/**
 * Resolves the path to the CodeMachine package.json file.
 *
 * Resolution order:
 * 1. CODEMACHINE_PACKAGE_JSON environment variable
 * 2. package.json in the resolved package root
 *
 * @param moduleUrl - import.meta.url of the calling module
 * @param errorContext - Context string for error messages
 * @returns Absolute path to package.json
 * @throws Error if package.json cannot be located
 */
export function resolvePackageJson(moduleUrl: string, errorContext: string): string {
  // 1. Check for explicit env override
  const explicitPath = process.env.CODEMACHINE_PACKAGE_JSON;
  if (explicitPath && existsSync(explicitPath)) {
    return explicitPath;
  }

  // 2. Resolve from package root
  const root = resolveRoot(moduleUrl, errorContext);
  const candidate = join(root, 'package.json');
  if (existsSync(candidate)) {
    return candidate;
  }

  throw new Error(`Unable to locate package.json from ${errorContext}`);
}

/**
 * Re-export for backwards compatibility.
 */
export function resolvePackageRoot(moduleUrl: string, errorContext: string): string {
  return resolveRoot(moduleUrl, errorContext);
}

// Convenience alias for new code
export { resolvePackageJson as getPkgJson };
