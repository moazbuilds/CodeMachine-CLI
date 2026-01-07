import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appDebug } from '../logging/logger.js';

let cachedPackageRoot: string | null = null;

/**
 * Validates that a directory contains a codemachine package.json.
 */
function validatePackageRoot(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;

  const pkgPath = join(candidate, 'package.json');
  if (!existsSync(pkgPath)) return undefined;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg?.name === 'codemachine' ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the CodeMachine package root directory.
 *
 * Resolution order:
 * 1. Environment variables: CODEMACHINE_PACKAGE_ROOT, CODEMACHINE_INSTALL_DIR
 * 2. Traverse filesystem from the given module URL
 */
export function resolvePackageRoot(moduleUrl: string, errorContext: string): string {
  appDebug('[Root] resolvePackageRoot called from: %s', errorContext);
  appDebug('[Root] moduleUrl: %s', moduleUrl);

  if (cachedPackageRoot) {
    appDebug('[Root] Using cached packageRoot: %s', cachedPackageRoot);
    return cachedPackageRoot;
  }

  // 1. Try environment variables first
  appDebug('[Root] CODEMACHINE_PACKAGE_ROOT: %s', process.env.CODEMACHINE_PACKAGE_ROOT ?? '(not set)');
  appDebug('[Root] CODEMACHINE_INSTALL_DIR: %s', process.env.CODEMACHINE_INSTALL_DIR ?? '(not set)');

  const envCandidates = [
    process.env.CODEMACHINE_PACKAGE_ROOT,
    process.env.CODEMACHINE_INSTALL_DIR,
  ];

  for (const candidate of envCandidates) {
    const validated = validatePackageRoot(candidate);
    if (validated) {
      appDebug('[Root] Resolved from env var: %s', validated);
      cachedPackageRoot = validated;
      return validated;
    }
  }

  // 2. Fallback to filesystem traversal
  let currentDir = dirname(fileURLToPath(moduleUrl));
  appDebug('[Root] Env vars not valid, traversing filesystem from: %s', currentDir);
  const maxDepth = 20;

  for (let depth = 0; depth < maxDepth; depth++) {
    const validated = validatePackageRoot(currentDir);
    if (validated) {
      appDebug('[Root] Resolved from filesystem traversal: %s (depth=%s)', validated, depth);
      cachedPackageRoot = validated;
      // Set env var for other modules (like MCP setup) that check it directly
      process.env.CODEMACHINE_PACKAGE_ROOT ??= validated;
      return validated;
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  appDebug('[Root] Failed to resolve package root');
  throw new Error(
    `Unable to locate package root from ${errorContext}. ` +
    `Searched from ${dirname(fileURLToPath(moduleUrl))}`
  );
}

/**
 * Resolves the path to the CodeMachine package.json file.
 */
export function resolvePackageJson(moduleUrl: string, errorContext: string): string {
  const root = resolvePackageRoot(moduleUrl, errorContext);
  return join(root, 'package.json');
}
