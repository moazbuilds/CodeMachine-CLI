import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  if (cachedPackageRoot) {
    return cachedPackageRoot;
  }

  // 1. Try environment variables first
  const envCandidates = [
    process.env.CODEMACHINE_PACKAGE_ROOT,
    process.env.CODEMACHINE_INSTALL_DIR,
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
  const maxDepth = 20;

  for (let depth = 0; depth < maxDepth; depth++) {
    const validated = validatePackageRoot(currentDir);
    if (validated) {
      cachedPackageRoot = validated;
      return validated;
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

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
