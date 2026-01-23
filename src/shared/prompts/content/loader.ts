import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { isGlobPattern, matchGlobPattern } from './glob.js';
import { debug } from '../../logging/logger.js';

/**
 * Loads content from a single file
 */
async function loadFileContent(absolutePath: string): Promise<string> {
  debug('[PLACEHOLDER-CONTENT] Loading single file: %s', absolutePath);
  try {
    const content = await readFile(absolutePath, 'utf8');
    debug('[PLACEHOLDER-CONTENT] Loaded file successfully (length: %d chars): %s', content.length, absolutePath);
    return content;
  } catch (error) {
    debug('[PLACEHOLDER-CONTENT] FAILED to load file: %s - %s', absolutePath, (error as Error).message);
    throw new Error(
      `Failed to read file ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Loads content from multiple files matching a glob pattern
 * Returns concatenated content with clear markdown separators and file headers
 */
async function loadGlobContent(baseDir: string, pattern: string): Promise<string> {
  debug('[PLACEHOLDER-CONTENT] Loading glob pattern: %s (baseDir: %s)', pattern, baseDir);
  const matchedFiles = await matchGlobPattern(baseDir, pattern);

  if (matchedFiles.length === 0) {
    debug('[PLACEHOLDER-CONTENT] No files matched pattern: %s', pattern);
    throw new Error(`No files matched the pattern: ${pattern}`);
  }

  debug('[PLACEHOLDER-CONTENT] Glob matched %d files: %s', matchedFiles.length, matchedFiles.join(', '));

  // Read all matched files and format with headers and separators
  const formattedContents: string[] = [];
  for (const file of matchedFiles) {
    try {
      const content = await readFile(file, 'utf8');
      const fileName = path.basename(file);
      // Format each file with a header and content
      const formattedContent = `<!-- File: ${fileName} -->\n\n${content.trim()}`;
      formattedContents.push(formattedContent);
      debug('[PLACEHOLDER-CONTENT] Loaded glob file: %s (length: %d)', fileName, content.length);
    } catch (error) {
      debug('[PLACEHOLDER-CONTENT] FAILED to load glob file: %s - %s', file, (error as Error).message);
      throw new Error(
        `Failed to read file ${file}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Join files with markdown horizontal rule separator
  const combined = formattedContents.join('\n\n---\n\n');
  debug('[PLACEHOLDER-CONTENT] Glob content combined: %d files -> %d chars', matchedFiles.length, combined.length);
  return combined;
}

/**
 * Loads content for a placeholder
 * Handles both single files and glob patterns
 *
 * @param baseDir - Base directory for resolving relative paths
 * @param filePath - File path or glob pattern (relative or absolute)
 * @returns The file content (or concatenated content for globs)
 * @throws Error if the file(s) cannot be read
 */
export async function loadPlaceholderContent(
  baseDir: string,
  filePath: string,
): Promise<string> {
  debug('[PLACEHOLDER-CONTENT] loadPlaceholderContent: baseDir=%s, filePath=%s', baseDir, filePath);

  // Check if it's a glob pattern
  if (isGlobPattern(filePath)) {
    debug('[PLACEHOLDER-CONTENT] Detected glob pattern: %s', filePath);
    return loadGlobContent(baseDir, filePath);
  }

  // Single file - resolve to absolute path
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
  debug('[PLACEHOLDER-CONTENT] Resolved to absolute path: %s', absolutePath);
  return loadFileContent(absolutePath);
}
