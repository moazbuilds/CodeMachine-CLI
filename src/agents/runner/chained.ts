import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { debug } from '../../shared/logging/logger.js';
import type { ChainedPathEntry, ConditionalChainedPath } from '../../shared/agents/config/types.js';
import { resolvePathWithImports } from '../../shared/imports/index.js';
import { resolvePackageRoot } from '../../shared/runtime/root.js';

const packageRoot = resolvePackageRoot(import.meta.url, 'chained prompts');

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
 * Load a single chained prompt from a file
 * Checks imported packages first, then project root
 */
async function loadPromptFromFile(
  filePath: string,
  projectRoot: string
): Promise<ChainedPrompt | null> {
  let absolutePath: string;
  if (path.isAbsolute(filePath)) {
    absolutePath = filePath;
  } else {
    // Try to resolve from imports first, then fall back to project root
    const importResolved = resolvePathWithImports(filePath, packageRoot, [projectRoot]);
    absolutePath = importResolved ?? path.resolve(projectRoot, filePath);
  }

  try {
    const rawContent = await fs.readFile(absolutePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(rawContent);
    const filename = path.basename(absolutePath);

    debug(`Loaded chained prompt from file: ${absolutePath}`);
    return {
      name: frontmatter.name || filenameToName(filename),
      label: frontmatter.description || filenameToLabel(filename),
      content: body.trim(),
    };
  } catch (err) {
    debug(`Failed to read chained prompt file ${absolutePath}: ${err}`);
    return null;
  }
}

/**
 * Load chained prompts from a single folder
 * Checks imported packages first, then project root
 */
async function loadPromptsFromFolder(
  folderPath: string,
  projectRoot: string
): Promise<ChainedPrompt[]> {
  // Resolve path - check imports first
  let absolutePath: string;
  if (path.isAbsolute(folderPath)) {
    absolutePath = folderPath;
  } else {
    const importResolved = resolvePathWithImports(folderPath, packageRoot, [projectRoot]);
    absolutePath = importResolved ?? path.resolve(projectRoot, folderPath);
  }

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
 * Load chained prompts from a path (file or folder)
 * Checks imported packages first, then project root
 */
async function loadPromptsFromPath(
  inputPath: string,
  projectRoot: string
): Promise<ChainedPrompt[]> {
  let absolutePath: string;
  if (path.isAbsolute(inputPath)) {
    absolutePath = inputPath;
  } else {
    const importResolved = resolvePathWithImports(inputPath, packageRoot, [projectRoot]);
    absolutePath = importResolved ?? path.resolve(projectRoot, inputPath);
  }

  try {
    const stat = await fs.stat(absolutePath);

    if (stat.isFile()) {
      const prompt = await loadPromptFromFile(absolutePath, projectRoot);
      return prompt ? [prompt] : [];
    } else if (stat.isDirectory()) {
      return loadPromptsFromFolder(absolutePath, projectRoot);
    } else {
      debug(`chainedPromptsPath is neither a file nor directory: ${absolutePath}`);
      return [];
    }
  } catch {
    debug(`chainedPromptsPath does not exist: ${absolutePath}`);
    return [];
  }
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
  const requiredAll = entry.conditions ?? [];
  const requiredAny = entry.conditionsAny ?? [];

  if (requiredAll.length > 0 && !requiredAll.every(c => selectedConditions.includes(c))) {
    return false;
  }

  if (requiredAny.length > 0 && !requiredAny.some(c => selectedConditions.includes(c))) {
    return false;
  }

  return true;
}

/**
 * Check if track requirement is met
 * If entry has tracks specified, selectedTrack must be one of them
 */
function meetsTracks(entry: ChainedPathEntry, selectedTrack: string | null): boolean {
  if (typeof entry === 'string') return true;
  if (!entry.tracks?.length) return true;
  if (!selectedTrack) return false; // Has track requirement but no track selected
  return entry.tracks.includes(selectedTrack);
}

/**
 * Extract path string from entry
 */
function getPath(entry: ChainedPathEntry): string {
  return typeof entry === 'string' ? entry : entry.path;
}

/**
 * Load chained prompts from one or more paths (files or folders)
 * Files are sorted by filename within each folder (01-first.md, 02-second.md, etc.)
 * When multiple paths are provided, prompts are loaded in path order
 *
 * @param chainedPromptsPath - Path or array of paths to file(s) or folder(s) containing .md files
 * @param projectRoot - Project root for resolving relative paths
 * @param selectedConditions - User-selected conditions for filtering conditional paths
 * @param selectedTrack - User-selected track for filtering track-specific paths
 * @returns Array of ChainedPrompt objects sorted by filename within each folder
 */
export async function loadChainedPrompts(
  chainedPromptsPath: ChainedPathEntry | ChainedPathEntry[],
  projectRoot: string,
  selectedConditions: string[] = [],
  selectedTrack: string | null = null
): Promise<ChainedPrompt[]> {
  const entries = Array.isArray(chainedPromptsPath) ? chainedPromptsPath : [chainedPromptsPath];
  const allPrompts: ChainedPrompt[] = [];

  for (const entry of entries) {
    // Check both conditions AND tracks (both must pass)
    if (!meetsConditions(entry, selectedConditions)) {
      const pathStr = getPath(entry);
      const conditionsAll = isConditionalPath(entry) ? entry.conditions : [];
      const conditionsAny = isConditionalPath(entry) ? entry.conditionsAny : [];
      debug(
        `Skipped chained path: ${pathStr} (unmet conditions: all=${conditionsAll?.join(', ') || 'n/a'}, any=${conditionsAny?.join(', ') || 'n/a'})`
      );
      continue;
    }

    if (!meetsTracks(entry, selectedTrack)) {
      const pathStr = getPath(entry);
      const tracks = isConditionalPath(entry) ? entry.tracks : [];
      debug(`Skipped chained path: ${pathStr} (unmet tracks: ${tracks?.join(', ')}, selected: ${selectedTrack})`);
      continue;
    }

    const inputPath = getPath(entry);
    const prompts = await loadPromptsFromPath(inputPath, projectRoot);
    allPrompts.push(...prompts);
  }

  return allPrompts;
}
