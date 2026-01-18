import * as path from 'node:path';
import { readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { getAllInstalledImports } from '../../imports/index.js';

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
 * Match files in a single directory
 */
async function matchInDirectory(
  directory: string,
  filePattern: string,
  regex: RegExp
): Promise<string[]> {
  if (!existsSync(directory)) {
    return [];
  }

  const files = await readdir(directory);
  const matchedFiles: string[] = [];

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

  return matchedFiles;
}

/**
 * Matches files against a glob pattern
 * Returns an array of absolute file paths sorted alphabetically
 * Searches imported packages first, then the base directory
 */
export async function matchGlobPattern(
  baseDir: string,
  pattern: string,
): Promise<string[]> {
  const matchedFiles: string[] = [];
  const seenFiles = new Set<string>();

  // If pattern is absolute, just search that location
  if (path.isAbsolute(pattern)) {
    const directory = path.dirname(pattern);
    const filePattern = path.basename(pattern);
    const regex = globToRegex(filePattern);

    const files = await matchInDirectory(directory, filePattern, regex);
    return files.sort((a, b) => {
      const nameA = path.basename(a).toLowerCase();
      const nameB = path.basename(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  // Get relative pattern parts
  const patternDir = path.dirname(pattern);
  const filePattern = path.basename(pattern);
  const regex = globToRegex(filePattern);

  // Search imported packages first (they take precedence)
  const imports = getAllInstalledImports();
  for (const imp of imports) {
    // If pattern starts with prompts/, check the import's prompts directory
    if (pattern.startsWith('prompts/')) {
      const subPath = pattern.replace(/^prompts\//, '').replace(/^templates\//, '');
      const importDir = path.join(imp.resolvedPaths.prompts, path.dirname(subPath));
      const files = await matchInDirectory(importDir, filePattern, regex);
      for (const file of files) {
        const basename = path.basename(file);
        if (!seenFiles.has(basename)) {
          seenFiles.add(basename);
          matchedFiles.push(file);
        }
      }
    }

    // Also check direct path from import root
    const importDir = path.join(imp.path, patternDir);
    const files = await matchInDirectory(importDir, filePattern, regex);
    for (const file of files) {
      const basename = path.basename(file);
      if (!seenFiles.has(basename)) {
        seenFiles.add(basename);
        matchedFiles.push(file);
      }
    }
  }

  // Search base directory
  const localDir = path.resolve(baseDir, patternDir);
  try {
    const files = await matchInDirectory(localDir, filePattern, regex);
    for (const file of files) {
      const basename = path.basename(file);
      if (!seenFiles.has(basename)) {
        seenFiles.add(basename);
        matchedFiles.push(file);
      }
    }
  } catch {
    // Ignore errors for local directory
  }

  // Sort alphabetically (a-z)
  return matchedFiles.sort((a, b) => {
    const nameA = path.basename(a).toLowerCase();
    const nameB = path.basename(b).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}
