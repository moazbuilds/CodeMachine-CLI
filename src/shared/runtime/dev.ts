import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: string | null | undefined = undefined;

/**
 * Returns the repo root when running in dev mode (`bun run dev` / `bun link`),
 * or `null` when running from a compiled binary.
 *
 * Traverses up from this file looking for a `package.json` with
 * `"name": "codemachine"`. Caches the result after the first call.
 */
export function getDevRoot(): string | null {
  if (cached !== undefined) return cached;

  let currentDir: string;
  try {
    currentDir = dirname(fileURLToPath(import.meta.url));
  } catch {
    cached = null;
    return null;
  }

  // In compiled binaries the path starts with /$bunfs — no real filesystem
  if (currentDir.startsWith('/$bunfs')) {
    cached = null;
    return null;
  }

  const maxDepth = 20;
  for (let i = 0; i < maxDepth; i++) {
    const pkgPath = join(currentDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg?.name === 'codemachine') {
          cached = currentDir;
          return cached;
        }
      } catch {
        // bad JSON, keep going
      }
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  cached = null;
  return null;
}
