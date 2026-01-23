import type { PlaceholderMatch } from '../config/types.js';
import { debug } from '../../logging/logger.js';

/**
 * Regular expression to match placeholders in the format:
 * - {placeholder_name} - Required placeholder
 * - {!placeholder_name} - Optional placeholder (won't throw error if missing)
 */
export const PLACEHOLDER_PATTERN = /\{(!)?([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/**
 * Parses a placeholder match into structured data
 *
 * @param match - RegExp match array from PLACEHOLDER_PATTERN
 * @returns Parsed placeholder information
 */
export function parsePlaceholder(match: RegExpMatchArray): PlaceholderMatch {
  const fullMatch = match[0]; // e.g., "{!plan_fallback}" or "{architecture}"
  const optionalPrefix = match[1]; // "!" if present, undefined otherwise
  const name = match[2]; // e.g., "plan_fallback" or "architecture"

  const result = {
    fullMatch,
    isOptional: optionalPrefix === '!',
    name,
  };

  debug('[PLACEHOLDER-PARSER] Parsed placeholder: "%s" -> name=%s, optional=%s', fullMatch, name, result.isOptional);
  return result;
}

/**
 * Finds all placeholders in a prompt string
 *
 * @param prompt - The prompt string to parse
 * @returns Array of parsed placeholder matches
 */
export function findPlaceholders(prompt: string): PlaceholderMatch[] {
  debug('[PLACEHOLDER-PARSER] Finding placeholders in prompt (length: %d chars)', prompt.length);
  debug('[PLACEHOLDER-PARSER] Prompt preview: "%s..."', prompt.substring(0, 200));

  const matches = Array.from(prompt.matchAll(PLACEHOLDER_PATTERN));
  debug('[PLACEHOLDER-PARSER] Found %d raw regex matches', matches.length);

  const parsed = matches.map(parsePlaceholder);
  debug('[PLACEHOLDER-PARSER] Parsed %d placeholders: %s', parsed.length, parsed.map(p => p.name).join(', '));

  return parsed;
}

/**
 * Gets unique placeholder names from the prompt
 *
 * @param prompt - The prompt string to parse
 * @returns Set of unique placeholder names
 */
export function getUniquePlaceholderNames(prompt: string): Set<string> {
  const placeholders = findPlaceholders(prompt);
  const uniqueNames = new Set(placeholders.map((p) => p.name));
  debug('[PLACEHOLDER-PARSER] Unique placeholder names (%d): %s', uniqueNames.size, Array.from(uniqueNames).join(', '));
  return uniqueNames;
}
