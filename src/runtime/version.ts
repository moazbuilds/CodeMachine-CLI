import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cachedVersion: string | null = null;

export function getVersion(): string {
  if (cachedVersion) return cachedVersion;

  let currentDir = import.meta.dir || __dirname;
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(currentDir, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg?.name === 'codemachine' && pkg?.version) {
        cachedVersion = pkg.version as string;
        return cachedVersion;
      }
    } catch {
      // Try parent directory
    }
    const parent = join(currentDir, '..');
    if (parent === currentDir) break;
    currentDir = parent;
  }

  cachedVersion = '0.0.0';
  return cachedVersion!
}

export const VERSION = getVersion();
