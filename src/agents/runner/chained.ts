import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { debug } from '../../shared/logging/logger.js';

/**
 * Represents a chained prompt loaded from a .md file
 */
export interface ChainedPrompt {
  name: string;      // filename without extension: "01-review-code"
  label: string;     // human readable: "Review Code"
  content: string;   // full prompt content from .md file
}

/**
 * Convert filename to human-readable label
 * "01-review-code.md" -> "Review Code"
 */
function filenameToLabel(filename: string): string {
  // Remove extension
  const name = filename.replace(/\.md$/i, '');

  // Remove leading number prefix (e.g., "01-", "02-")
  const withoutPrefix = name.replace(/^\d+-/, '');

  // Convert kebab-case to Title Case
  return withoutPrefix
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Load chained prompts from a folder
 * Files are sorted by filename (01-first.md, 02-second.md, etc.)
 *
 * @param chainedPromptsPath - Absolute or relative path to folder containing .md files
 * @param projectRoot - Project root for resolving relative paths
 * @returns Array of ChainedPrompt objects sorted by filename
 */
export async function loadChainedPrompts(
  chainedPromptsPath: string,
  projectRoot: string
): Promise<ChainedPrompt[]> {
  // Resolve path
  const absolutePath = path.isAbsolute(chainedPromptsPath)
    ? chainedPromptsPath
    : path.resolve(projectRoot, chainedPromptsPath);

  // Check if directory exists
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isDirectory()) {
      debug(`chainedPromptsPath is not a directory: ${absolutePath}`);
      return [];
    }
  } catch {
    debug(`chainedPromptsPath does not exist: ${absolutePath}`);
    return [];
  }

  // Read directory contents
  const files = await fs.readdir(absolutePath);

  // Filter .md files and sort by filename
  const mdFiles = files
    .filter(f => f.endsWith('.md'))
    .sort();

  // Load each file
  const prompts: ChainedPrompt[] = [];
  for (const filename of mdFiles) {
    const filePath = path.join(absolutePath, filename);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      prompts.push({
        name: filename.replace(/\.md$/i, ''),
        label: filenameToLabel(filename),
        content: content.trim(),
      });
    } catch (err) {
      debug(`Failed to read chained prompt file ${filePath}: ${err}`);
    }
  }

  debug(`Loaded ${prompts.length} chained prompts from ${absolutePath}`);
  return prompts;
}
