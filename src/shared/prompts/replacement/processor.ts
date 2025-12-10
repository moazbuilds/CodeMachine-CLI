import { readFile, stat } from 'node:fs/promises';
import { loadPlaceholdersConfig, resolvePlaceholderPath } from '../config/loader.js';
import { loadPlaceholderContent } from '../content/loader.js';
import { findPlaceholders, getUniquePlaceholderNames } from './parser.js';
import { handlePlaceholderLoadError } from './errors.js';
import { getBuiltInContent } from './builtins.js';

/**
 * Simple cache for placeholder content with file modification time tracking
 * Automatically invalidates when files are modified
 */
class PlaceholderCache {
  private cache: Map<string, { content: string; mtime: number }> = new Map();
  private maxSize = 100; // Maximum number of cached items

  /**
   * Get cached content if file hasn't been modified
   * Returns null if cache miss or file was modified
   */
  async get(filePath: string): Promise<string | null> {
    const cached = this.cache.get(filePath);
    if (!cached) {
      return null;
    }

    try {
      // Check if file was modified since caching
      const stats = await stat(filePath);
      const currentMtime = stats.mtimeMs;

      if (currentMtime === cached.mtime) {
        // Cache hit - file unchanged
        return cached.content;
      }

      // File was modified, invalidate cache
      this.cache.delete(filePath);
      return null;
    } catch {
      // File doesn't exist or can't be accessed, invalidate cache
      this.cache.delete(filePath);
      return null;
    }
  }

  /**
   * Store content in cache with current modification time
   */
  async set(filePath: string, content: string): Promise<void> {
    try {
      const stats = await stat(filePath);

      // Evict oldest entry if cache is full (simple FIFO, not true LRU but sufficient)
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }

      this.cache.set(filePath, {
        content,
        mtime: stats.mtimeMs,
      });
    } catch {
      // Ignore errors when setting cache
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const placeholderCache = new PlaceholderCache();

/**
 * Load placeholder content with caching support
 * Checks cache first, then loads from disk if needed
 */
async function loadPlaceholderContentCached(
  baseDir: string,
  filePath: string,
): Promise<string> {
  // Try to get from cache first
  const cached = await placeholderCache.get(filePath);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - load from disk
  const content = await loadPlaceholderContent(baseDir, filePath);

  // Store in cache for future use
  await placeholderCache.set(filePath, content);

  return content;
}

/**
 * Replaces all placeholders in the prompt with their corresponding content
 *
 * Supports two types of placeholders:
 * - {placeholder_name} - Required placeholder (throws error if file not found)
 * - {!placeholder_name} - Optional placeholder (skips if file not found)
 *
 * Uses caching to avoid re-reading files on repeated calls
 * Loads all placeholders in parallel for 3-4x faster execution
 *
 * @param prompt - The prompt string containing placeholders
 * @param cwd - Current working directory for resolving user-level placeholders
 * @returns The prompt with all placeholders replaced
 * @throws PlaceholderError if a required placeholder cannot be loaded
 */
async function replacePlaceholders(
  prompt: string,
  cwd: string,
): Promise<string> {
  const config = loadPlaceholdersConfig();
  let processedPrompt = prompt;

  // Find all placeholders in the prompt
  const placeholders = findPlaceholders(prompt);
  const uniquePlaceholderNames = getUniquePlaceholderNames(prompt);

  // Convert Set to Array for mapping
  const placeholderNamesArray = Array.from(uniquePlaceholderNames);

  // Load all placeholders in parallel
  const loadTasks = placeholderNamesArray.map(async (placeholderName) => {
    // Check if it's a built-in dynamic placeholder first
    const builtInContent = await getBuiltInContent(placeholderName, cwd);
    if (builtInContent !== null) {
      return { placeholderName, content: builtInContent, isOptional: false };
    }

    // Find if this placeholder is optional by checking the first occurrence
    const firstOccurrence = placeholders.find((p) => p.name === placeholderName);
    const isOptional = firstOccurrence?.isOptional || false;

    // Resolve placeholder path from config
    const resolved = resolvePlaceholderPath(placeholderName, cwd, config);

    if (!resolved) {
      console.warn(
        `Warning: Placeholder {${isOptional ? '!' : ''}${placeholderName}} found in prompt but not defined in config/placeholders.js`
      );
      return { placeholderName, content: '', isOptional };
    }

    const { filePath, baseDir } = resolved;

    try {
      // Load the placeholder content (with caching)
      const content = await loadPlaceholderContentCached(baseDir, filePath);
      return { placeholderName, content, isOptional };
    } catch (error) {
      // Handle error based on whether placeholder is optional
      const fallbackContent = handlePlaceholderLoadError(
        placeholderName,
        filePath,
        isOptional,
        error as Error,
      );
      return { placeholderName, content: fallbackContent, isOptional };
    }
  });

  // Wait for all placeholders to load in parallel
  const loadedPlaceholders = await Promise.all(loadTasks);

  // Replace all placeholders with their loaded content
  for (const { placeholderName, content } of loadedPlaceholders) {
    // Replace ALL occurrences of this placeholder (with and without !)
    const withOptionalRegex = new RegExp(`\\{!${placeholderName}\\}`, 'g');
    const withoutOptionalRegex = new RegExp(`\\{${placeholderName}\\}`, 'g');

    processedPrompt = processedPrompt.replace(withOptionalRegex, content);
    processedPrompt = processedPrompt.replace(withoutOptionalRegex, content);
  }

  return processedPrompt;
}

/**
 * Processes a prompt by loading it from file and replacing all placeholders
 * Template files are also cached for better performance
 *
 * @param promptPath - Path to the prompt file
 * @param cwd - Current working directory
 * @returns The processed prompt with placeholders replaced
 */
export async function processPrompt(
  promptPath: string,
  cwd: string,
): Promise<string> {
  // Try to get template from cache first
  let prompt = await placeholderCache.get(promptPath);

  if (prompt === null) {
    // Cache miss - load from disk
    prompt = await readFile(promptPath, 'utf8');

    // Cache the template for future use
    await placeholderCache.set(promptPath, prompt);
  }

  // Replace all placeholders (placeholders themselves are also cached)
  return replacePlaceholders(prompt, cwd);
}

/**
 * Processes a prompt string (already loaded) by replacing all placeholders
 *
 * @param prompt - The prompt string containing placeholders
 * @param cwd - Current working directory
 * @returns The processed prompt with placeholders replaced
 */
export async function processPromptString(
  prompt: string,
  cwd: string,
): Promise<string> {
  return replacePlaceholders(prompt, cwd);
}
