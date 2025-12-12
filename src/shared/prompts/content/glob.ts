import * as path from 'node:path';
import { readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';

/**
 * Checks if a path contains glob patterns
 */
export function isGlobPattern(filePath: string): boolean {
  return filePath.includes('*') || filePath.includes('?') || filePath.includes('[');
}

/**
 * Converts a glob pattern to a RegExp
 * Supports: * (any chars), ? (single char), [abc] (char class)
 * Examples:
 *   *.md -> matches file.md
 *   product-brief-*.md -> matches product-brief-2025-12-11.md
 *   file?.txt -> matches file1.txt
 */
function globToRegex(pattern: string): RegExp {
  let regex = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*') {
      regex += '.*';
    } else if (char === '?') {
      regex += '.';
    } else if (char === '[') {
      // Find closing bracket
      const closeIdx = pattern.indexOf(']', i);
      if (closeIdx !== -1) {
        regex += pattern.slice(i, closeIdx + 1);
        i = closeIdx;
      } else {
        regex += '\\[';
      }
    } else if ('.^$+{}()|\\'.includes(char)) {
      // Escape regex special chars
      regex += '\\' + char;
    } else {
      regex += char;
    }
    i++;
  }

  return new RegExp(`^${regex}$`);
}

/**
 * Matches files against a glob pattern
 * Returns an array of absolute file paths sorted alphabetically
 */
export async function matchGlobPattern(
  baseDir: string,
  pattern: string,
): Promise<string[]> {
  const absolutePattern = path.isAbsolute(pattern) ? pattern : path.resolve(baseDir, pattern);
  const directory = path.dirname(absolutePattern);
  const filePattern = path.basename(absolutePattern);

  if (!existsSync(directory)) {
    return [];
  }

  try {
    const files = await readdir(directory);
    const matchedFiles: string[] = [];
    const regex = globToRegex(filePattern);

    for (const file of files) {
      const fullPath = path.join(directory, file);

      // Check if it's a file (not directory)
      try {
        const stats = statSync(fullPath);
        if (!stats.isFile()) continue;
      } catch {
        continue;
      }

      // Match against glob pattern regex
      if (regex.test(file)) {
        matchedFiles.push(fullPath);
      }
    }

    // Sort alphabetically (a-z)
    return matchedFiles.sort((a, b) => {
      const nameA = path.basename(a).toLowerCase();
      const nameB = path.basename(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } catch (error) {
    throw new Error(
      `Failed to match glob pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
