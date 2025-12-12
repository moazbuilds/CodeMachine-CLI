import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { debug } from '../../shared/logging/logger.js';
import type { ChainedPathEntry, ConditionalChainedPath } from '../../shared/agents/config/types.js';

/**
 * Represents a chained prompt loaded from a .md file
 */
export interface ChainedPrompt {
  name: string;      // from frontmatter or filename: "step-03-users"
  label: string;     // from frontmatter description or filename: "Define target users..."
  content: string;   // prompt content (without frontmatter)
}

/**
 * Frontmatter fields supported in chained prompt files
 */
interface PromptFrontmatter {
  name?: string;
  description?: string;
}

/**
 * Parse YAML frontmatter from markdown content
 * Returns frontmatter data and content without frontmatter
 */
function parseFrontmatter(content: string): { frontmatter: PromptFrontmatter; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterBlock = match[1];
  const body = content.slice(match[0].length);
  const frontmatter: PromptFrontmatter = {};

  // Simple YAML parsing for name and description
  for (const line of frontmatterBlock.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key === 'name') {
      frontmatter.name = value;
    } else if (key === 'description') {
      frontmatter.description = value;
    }
  }

  return { frontmatter, body };
}

/**
 * Convert filename to human-readable label (fallback)
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
 * Convert filename to name (fallback)
 * "01-review-code.md" -> "01-review-code"
 */
function filenameToName(filename: string): string {
  return filename.replace(/\.md$/i, '');
}

/**
 * Load chained prompts from a single folder
 */
async function loadPromptsFromFolder(
  folderPath: string,
  projectRoot: string
): Promise<ChainedPrompt[]> {
  // Resolve path
  const absolutePath = path.isAbsolute(folderPath)
    ? folderPath
    : path.resolve(projectRoot, folderPath);

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
      const rawContent = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(rawContent);

      prompts.push({
        // Use frontmatter name if present, otherwise derive from filename
        name: frontmatter.name || filenameToName(filename),
        // Use frontmatter description if present, otherwise derive from filename
        label: frontmatter.description || filenameToLabel(filename),
        // Use body without frontmatter
        content: body.trim(),
      });
    } catch (err) {
      debug(`Failed to read chained prompt file ${filePath}: ${err}`);
    }
  }

  debug(`Loaded ${prompts.length} chained prompts from ${absolutePath}`);
  return prompts;
}

/**
 * Type guard for conditional path entry
 */
function isConditionalPath(entry: ChainedPathEntry): entry is ConditionalChainedPath {
  return typeof entry === 'object' && entry !== null && 'path' in entry;
}

/**
 * Check if all conditions are met (AND logic)
 */
function meetsConditions(entry: ChainedPathEntry, selectedConditions: string[]): boolean {
  if (typeof entry === 'string') return true;
  if (!entry.conditions?.length) return true;
  return entry.conditions.every(c => selectedConditions.includes(c));
}

/**
 * Extract path string from entry
 */
function getPath(entry: ChainedPathEntry): string {
  return typeof entry === 'string' ? entry : entry.path;
}

/**
 * Load chained prompts from one or more folders
 * Files are sorted by filename within each folder (01-first.md, 02-second.md, etc.)
 * When multiple folders are provided, prompts are loaded in folder order
 *
 * @param chainedPromptsPath - Path or array of paths to folder(s) containing .md files
 * @param projectRoot - Project root for resolving relative paths
 * @param selectedConditions - User-selected conditions for filtering conditional paths
 * @returns Array of ChainedPrompt objects sorted by filename within each folder
 */
export async function loadChainedPrompts(
  chainedPromptsPath: ChainedPathEntry | ChainedPathEntry[],
  projectRoot: string,
  selectedConditions: string[] = []
): Promise<ChainedPrompt[]> {
  const entries = Array.isArray(chainedPromptsPath) ? chainedPromptsPath : [chainedPromptsPath];
  const allPrompts: ChainedPrompt[] = [];

  for (const entry of entries) {
    if (!meetsConditions(entry, selectedConditions)) {
      const pathStr = getPath(entry);
      const conditions = isConditionalPath(entry) ? entry.conditions : [];
      debug(`Skipped chained path: ${pathStr} (unmet conditions: ${conditions?.join(', ')})`);
      continue;
    }

    const folderPath = getPath(entry);
    const prompts = await loadPromptsFromFolder(folderPath, projectRoot);
    allPrompts.push(...prompts);
  }

  return allPrompts;
}
