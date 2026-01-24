import { readFile, stat } from 'node:fs/promises';
import { loadPlaceholdersConfig, resolvePlaceholderPath } from '../config/loader.js';
import { loadPlaceholderContent } from '../content/loader.js';
import { findPlaceholders, getUniquePlaceholderNames } from './parser.js';
import { handlePlaceholderLoadError } from './errors.js';
import { getBuiltInContent } from './builtins.js';
import { debug } from '../../logging/logger.js';

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
      debug('[PLACEHOLDER-CACHE] Cache MISS for: %s', filePath);
      return null;
    }

    try {
      // Check if file was modified since caching
      const stats = await stat(filePath);
      const currentMtime = stats.mtimeMs;

      if (currentMtime === cached.mtime) {
        // Cache hit - file unchanged
        debug('[PLACEHOLDER-CACHE] Cache HIT for: %s (content length: %d)', filePath, cached.content.length);
        return cached.content;
      }

      // File was modified, invalidate cache
      debug('[PLACEHOLDER-CACHE] Cache STALE for: %s (mtime changed from %d to %d)', filePath, cached.mtime, currentMtime);
      this.cache.delete(filePath);
      return null;
    } catch {
      // File doesn't exist or can't be accessed, invalidate cache
      debug('[PLACEHOLDER-CACHE] Cache INVALIDATED for: %s (file access error)', filePath);
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
          debug('[PLACEHOLDER-CACHE] Evicting oldest cache entry: %s', firstKey);
          this.cache.delete(firstKey);
        }
      }

      this.cache.set(filePath, {
        content,
        mtime: stats.mtimeMs,
      });
      debug('[PLACEHOLDER-CACHE] Cached: %s (content length: %d, mtime: %d)', filePath, content.length, stats.mtimeMs);
    } catch (err) {
      // Ignore errors when setting cache
      debug('[PLACEHOLDER-CACHE] Failed to cache: %s (error: %s)', filePath, (err as Error).message);
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    debug('[PLACEHOLDER-CACHE] Clearing all %d cached entries', this.cache.size);
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
  debug('[PLACEHOLDER-PROCESSOR] loadPlaceholderContentCached: baseDir=%s, filePath=%s', baseDir, filePath);

  // Try to get from cache first
  const cached = await placeholderCache.get(filePath);
  if (cached !== null) {
    debug('[PLACEHOLDER-PROCESSOR] Using cached content for: %s', filePath);
    return cached;
  }

  // Cache miss - load from disk
  debug('[PLACEHOLDER-PROCESSOR] Loading from disk: %s', filePath);
  const content = await loadPlaceholderContent(baseDir, filePath);
  debug('[PLACEHOLDER-PROCESSOR] Loaded content (length: %d) from: %s', content.length, filePath);

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
  debug('[PLACEHOLDER-PROCESSOR] === START replacePlaceholders ===');
  debug('[PLACEHOLDER-PROCESSOR] cwd: %s', cwd);
  debug('[PLACEHOLDER-PROCESSOR] Input prompt length: %d chars', prompt.length);

  const config = loadPlaceholdersConfig();
  debug('[PLACEHOLDER-PROCESSOR] Loaded config with %d userDir placeholders, %d packageDir placeholders',
    Object.keys(config.userDir || {}).length,
    Object.keys(config.packageDir || {}).length
  );

  let processedPrompt = prompt;

  // Find all placeholders in the prompt
  const placeholders = findPlaceholders(prompt);
  const uniquePlaceholderNames = getUniquePlaceholderNames(prompt);

  debug('[PLACEHOLDER-PROCESSOR] Found %d total placeholders, %d unique names',
    placeholders.length, uniquePlaceholderNames.size
  );

  if (uniquePlaceholderNames.size === 0) {
    debug('[PLACEHOLDER-PROCESSOR] No placeholders found, returning original prompt');
    return processedPrompt;
  }

  // Convert Set to Array for mapping
  const placeholderNamesArray = Array.from(uniquePlaceholderNames);

  // Load all placeholders in parallel
  const loadTasks = placeholderNamesArray.map(async (placeholderName) => {
    debug('[PLACEHOLDER-PROCESSOR] Processing placeholder: %s', placeholderName);

    // Check if it's a built-in dynamic placeholder first
    const builtInContent = await getBuiltInContent(placeholderName, cwd);
    if (builtInContent !== null) {
      debug('[PLACEHOLDER-PROCESSOR] "%s" -> BUILT-IN content (length: %d)', placeholderName, builtInContent.length);
      return { placeholderName, content: builtInContent, isOptional: false };
    }
    debug('[PLACEHOLDER-PROCESSOR] "%s" -> Not a built-in placeholder', placeholderName);

    // Find if this placeholder is optional by checking the first occurrence
    const firstOccurrence = placeholders.find((p) => p.name === placeholderName);
    const isOptional = firstOccurrence?.isOptional || false;
    debug('[PLACEHOLDER-PROCESSOR] "%s" -> isOptional: %s', placeholderName, isOptional);

    // Resolve placeholder path from config
    const resolved = resolvePlaceholderPath(placeholderName, cwd, config);

    if (!resolved) {
      // Placeholder not defined in config - skip it entirely (leave as-is in prompt)
      debug('[PLACEHOLDER-PROCESSOR] "%s" -> NOT FOUND in config, skipping (will remain as-is in prompt)', placeholderName);
      return null;
    }

    const { filePath, baseDir } = resolved;
    debug('[PLACEHOLDER-PROCESSOR] "%s" -> Resolved to: %s (baseDir: %s)', placeholderName, filePath, baseDir);

    try {
      // Load the placeholder content (with caching)
      const content = await loadPlaceholderContentCached(baseDir, filePath);
      debug('[PLACEHOLDER-PROCESSOR] "%s" -> LOADED successfully (length: %d)', placeholderName, content.length);
      return { placeholderName, content, isOptional };
    } catch (error) {
      debug('[PLACEHOLDER-PROCESSOR] "%s" -> ERROR loading: %s', placeholderName, (error as Error).message);
      // Handle error based on whether placeholder is optional
      const fallbackContent = handlePlaceholderLoadError(
        placeholderName,
        filePath,
        isOptional,
        error as Error,
      );
      debug('[PLACEHOLDER-PROCESSOR] "%s" -> Using fallback content (length: %d)', placeholderName, fallbackContent.length);
      return { placeholderName, content: fallbackContent, isOptional };
    }
  });

  // Wait for all placeholders to load in parallel
  const loadedPlaceholders = (await Promise.all(loadTasks)).filter(
    (result): result is NonNullable<typeof result> => result !== null
  );

  debug('[PLACEHOLDER-PROCESSOR] Loaded %d placeholders (out of %d unique names)',
    loadedPlaceholders.length, uniquePlaceholderNames.size
  );

  // Replace all placeholders with their loaded content
  for (const { placeholderName, content } of loadedPlaceholders) {
    // Replace ALL occurrences of this placeholder (with and without !)
    const withOptionalRegex = new RegExp(`\\{!${placeholderName}\\}`, 'g');
    const withoutOptionalRegex = new RegExp(`\\{${placeholderName}\\}`, 'g');

    const beforeLength = processedPrompt.length;
    processedPrompt = processedPrompt.replace(withOptionalRegex, content);
    processedPrompt = processedPrompt.replace(withoutOptionalRegex, content);
    const afterLength = processedPrompt.length;

    debug('[PLACEHOLDER-PROCESSOR] Replaced "%s" -> prompt length changed from %d to %d',
      placeholderName, beforeLength, afterLength
    );
  }

  debug('[PLACEHOLDER-PROCESSOR] === END replacePlaceholders ===');
  debug('[PLACEHOLDER-PROCESSOR] Final prompt length: %d chars', processedPrompt.length);

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
  debug('[PLACEHOLDER-PROCESSOR] processPrompt called: promptPath=%s, cwd=%s', promptPath, cwd);

  // Try to get template from cache first
  let prompt = await placeholderCache.get(promptPath);

  if (prompt === null) {
    // Cache miss - load from disk
    debug('[PLACEHOLDER-PROCESSOR] Loading prompt template from disk: %s', promptPath);
    prompt = await readFile(promptPath, 'utf8');
    debug('[PLACEHOLDER-PROCESSOR] Loaded prompt template (length: %d)', prompt.length);

    // Cache the template for future use
    await placeholderCache.set(promptPath, prompt);
  } else {
    debug('[PLACEHOLDER-PROCESSOR] Using cached prompt template: %s', promptPath);
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
  debug('[PLACEHOLDER-PROCESSOR] processPromptString called: prompt length=%d, cwd=%s',
    prompt.length, cwd);
  return replacePlaceholders(prompt, cwd);
}
