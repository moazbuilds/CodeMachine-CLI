import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cached package root to avoid repeated filesystem operations.
 * Set to null initially, becomes string after first successful resolution.
 */
let cachedPackageRoot: string | null = null;

/**
 * Validates that a directory contains a codemachine package.json.
 * Returns the directory path if valid, undefined otherwise.
 */
function validatePackageRoot(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;

  const pkgPath = join(candidate, 'package.json');
  if (!existsSync(pkgPath)) return undefined;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg?.name !== 'codemachine') {
      return undefined;
    }

    // Validate templates directory exists and contains at least one workflow file
    const templatesDir = join(candidate, 'templates', 'workflows');
    if (!existsSync(templatesDir)) {
      return undefined;
    }

    const hasWorkflowFiles = readdirSync(templatesDir).some((entry) => entry.endsWith('.workflow.js'));
    if (!hasWorkflowFiles) {
      return undefined;
    }

    return candidate;
  } catch {
    // Ignore parse failures
  }

  return undefined;
}

/**
 * Resolves the CodeMachine package root directory.
 *
 * Resolution order:
 * 1. Check environment variables (set by wrapper script or build process):
 *    - CODEMACHINE_PACKAGE_ROOT
 *    - CODEMACHINE_INSTALL_DIR
 *    - CODEMACHINE_PACKAGE_JSON (extract dirname)
 * 2. Traverse filesystem from the given module URL
 * 3. Throw error if not found
 *
 * @param moduleUrl - import.meta.url of the calling module
 * @param errorContext - Context string for error messages
 * @returns Absolute path to package root
 * @throws Error if package root cannot be located
 */
export function resolvePackageRoot(moduleUrl: string, errorContext: string): string {
  // Return cached result if available
  if (cachedPackageRoot) {
    return cachedPackageRoot;
  }

  // 1. Try environment variables first
  const envCandidates = [
    process.env.CODEMACHINE_PACKAGE_ROOT,
    process.env.CODEMACHINE_INSTALL_DIR,
    process.env.CODEMACHINE_PACKAGE_JSON
      ? dirname(process.env.CODEMACHINE_PACKAGE_JSON)
      : undefined,
  ];

  for (const candidate of envCandidates) {
    const validated = validatePackageRoot(candidate);
    if (validated) {
      cachedPackageRoot = validated;
      return validated;
    }
  }

  // 2. Fallback to filesystem traversal
  let currentDir = dirname(fileURLToPath(moduleUrl));
  // Limit traversal to prevent infinite loops
  const maxDepth = 20;
  let depth = 0;

  while (depth < maxDepth) {
    const validated = validatePackageRoot(currentDir);
    if (validated) {
      cachedPackageRoot = validated;
      return validated;
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) {
      break; // Reached filesystem root
    }

    currentDir = parent;
    depth++;
  }

  // 3. Not found - throw error
  throw new Error(
    `Unable to locate package root from ${errorContext}. ` +
    `Searched environment variables and filesystem from ${dirname(fileURLToPath(moduleUrl))}`
  );
}

/**
 * Gets the cached package root or resolves it using a default module URL.
 * This is a convenience function for cases where you don't have import.meta.url.
 *
 * WARNING: This uses the location of this module as the starting point for resolution.
 * Prefer using resolvePackageRoot() with import.meta.url when possible.
 *
 * @returns Absolute path to package root
 * @throws Error if package root cannot be located
 */
export function getPackageRoot(): string {
  if (cachedPackageRoot) {
    return cachedPackageRoot;
  }

  // Use this module's location as fallback
  return resolvePackageRoot(import.meta.url, 'getPackageRoot()');
}

/**
 * Clears the cached package root.
 * Primarily useful for testing - you should rarely need this in production code.
 */
export function clearPackageRootCache(): void {
  cachedPackageRoot = null;
}

/**
 * Sets the package root explicitly.
 * Useful for testing or when you know the package root from elsewhere.
 *
 * @param root - Absolute path to package root
 */
export function setPackageRoot(root: string): void {
  cachedPackageRoot = root;
}

// Convenience alias for new code
export { getPackageRoot as getRoot, clearPackageRootCache as clearCache };
