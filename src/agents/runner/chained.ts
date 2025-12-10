import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { debug } from '../../shared/logging/logger.js';

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
