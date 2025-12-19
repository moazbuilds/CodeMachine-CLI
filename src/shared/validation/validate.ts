/**
 * Validation Utilities
 *
 * Helper functions for runtime validation using Zod schemas.
 */

import { z, ZodError, ZodSchema } from 'zod'
import type { Result } from '../types/index.js'

// ============================================================================
// Types
// ============================================================================

export interface ValidationError {
  path: (string | number)[]
  message: string
  code: string
}

export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: ValidationError[]
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate data against a Zod schema
 * Returns a Result type for functional error handling
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): Result<T, ValidationError[]> {
  const result = schema.safeParse(data)

  if (result.success) {
    return { ok: true, value: result.data }
  }

  return {
    ok: false,
    error: formatZodError(result.error),
  }
}

/**
 * Validate data and throw on failure
 * Use for internal boundaries where data should always be valid
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}

/**
 * Validate data and return undefined on failure
 * Use for optional/lenient validation
 */
export function validateOrUndefined<T>(
  schema: ZodSchema<T>,
  data: unknown
): T | undefined {
  const result = schema.safeParse(data)
  return result.success ? result.data : undefined
}

/**
 * Validate data with a fallback value
 */
export function validateWithFallback<T>(
  schema: ZodSchema<T>,
  data: unknown,
  fallback: T
): T {
  const result = schema.safeParse(data)
  return result.success ? result.data : fallback
}

/**
 * Check if data is valid without parsing
 */
export function isValid<T>(schema: ZodSchema<T>, data: unknown): data is T {
  return schema.safeParse(data).success
}

/**
 * Create a type guard from a schema
 */
export function createTypeGuard<T>(
  schema: ZodSchema<T>
): (data: unknown) => data is T {
  return (data: unknown): data is T => schema.safeParse(data).success
}

// ============================================================================
// Array Validation
// ============================================================================

/**
 * Validate array items, returning only valid items
 */
export function validateArray<T>(
  schema: ZodSchema<T>,
  items: unknown[]
): T[] {
  return items
    .map((item) => schema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => (result as { success: true; data: T }).data)
}

/**
 * Validate array items, returning results with indices
 */
export function validateArrayWithIndices<T>(
  schema: ZodSchema<T>,
  items: unknown[]
): { index: number; value: T }[] {
  return items
    .map((item, index) => ({ index, result: schema.safeParse(item) }))
    .filter(({ result }) => result.success)
    .map(({ index, result }) => ({
      index,
      value: (result as { success: true; data: T }).data,
    }))
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format Zod error into ValidationError array
 */
export function formatZodError(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path as (string | number)[],
    message: issue.message,
    code: String(issue.code),
  }))
}

/**
 * Format validation errors as human-readable string
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((err) => {
      const path = err.path.length > 0 ? `${err.path.join('.')}: ` : ''
      return `${path}${err.message}`
    })
    .join('\n')
}

/**
 * Get first validation error message
 */
export function getFirstError(errors: ValidationError[]): string | undefined {
  const first = errors[0]
  if (!first) return undefined
  const path = first.path.length > 0 ? `${first.path.join('.')}: ` : ''
  return `${first.message}`
}

// ============================================================================
// Schema Utilities
// ============================================================================

/**
 * Make schema fields optional
 */
export function makeOptional<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
) {
  return schema.partial()
}

/**
 * Validate partial object (only validate provided fields)
 */
export function validatePartial<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  data: unknown
) {
  return validate(schema.partial(), data)
}

/**
 * Validate and strip unknown keys
 */
export function validateStrict<T>(
  schema: ZodSchema<T>,
  data: unknown
): Result<T, ValidationError[]> {
  if (schema instanceof z.ZodObject) {
    return validate(schema.strict() as unknown as ZodSchema<T>, data)
  }
  return validate(schema, data)
}

// ============================================================================
// Async Validation
// ============================================================================

/**
 * Validate data asynchronously (for schemas with async refinements)
 */
export async function validateAsync<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<Result<T, ValidationError[]>> {
  const result = await schema.safeParseAsync(data)

  if (result.success) {
    return { ok: true, value: result.data }
  }

  return {
    ok: false,
    error: formatZodError(result.error),
  }
}

/**
 * Validate async and throw on failure
 */
export async function validateAsyncOrThrow<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<T> {
  return schema.parseAsync(data)
}

