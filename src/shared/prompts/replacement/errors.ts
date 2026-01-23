import { debug } from '../../logging/logger.js';

/**
 * Custom error class for placeholder processing
 */
export class PlaceholderError extends Error {
  constructor(
    message: string,
    public placeholderName: string,
    public filePath: string,
  ) {
    super(message);
    this.name = 'PlaceholderError';
  }
}

/**
 * Creates a detailed error message for a required placeholder that couldn't be loaded
 *
 * @param placeholderName - The name of the placeholder (e.g., "plan_fallback")
 * @param filePath - The file path that was expected
 * @returns A formatted error object
 */
export function createRequiredFileError(
  placeholderName: string,
  filePath: string,
): PlaceholderError {
  const message = `Required file not found: {${placeholderName}}

Expected file: ${filePath}`;

  return new PlaceholderError(message, placeholderName, filePath);
}

/**
 * Creates a warning message for an optional placeholder that couldn't be loaded
 * This is logged but doesn't throw an error
 *
 * @param placeholderName - The name of the placeholder
 * @param filePath - The file path that was expected
 */
export function createOptionalFileWarning(
  _placeholderName: string,
  _filePath: string,
): void {
  // Optional placeholders that fail to load are silently skipped
  // No warning is printed to avoid cluttering the output
}

/**
 * Handles placeholder load errors based on whether the placeholder is optional
 *
 * @param placeholderName - The name of the placeholder
 * @param filePath - The file path that failed to load
 * @param isOptional - Whether the placeholder has the ! prefix
 * @param error - The original error
 * @returns Empty string for optional placeholders
 * @throws PlaceholderError for required placeholders
 */
export function handlePlaceholderLoadError(
  placeholderName: string,
  filePath: string,
  isOptional: boolean,
  _error: Error,
): string {
  debug('[PLACEHOLDER-ERROR] handlePlaceholderLoadError: placeholder=%s, filePath=%s, isOptional=%s, error=%s',
    placeholderName, filePath, isOptional, _error.message
  );

  if (isOptional) {
    // For optional placeholders, log a warning and return empty string
    debug('[PLACEHOLDER-ERROR] Optional placeholder "%s" failed to load, returning empty string', placeholderName);
    createOptionalFileWarning(placeholderName, filePath);
    return '';
  }

  // For required placeholders, throw a detailed error
  debug('[PLACEHOLDER-ERROR] REQUIRED placeholder "%s" failed to load, throwing error', placeholderName);
  throw createRequiredFileError(placeholderName, filePath);
}
