/**
 * Validation Module
 *
 * Zod-based runtime validation for external data, API boundaries, and configs.
 */

// Re-export all schemas
export * from './schemas.js'

// Re-export validation utilities
export {
  validate,
  validateOrThrow,
  validateOrUndefined,
  validateWithFallback,
  isValid,
  createTypeGuard,
  validateArray,
  validateArrayWithIndices,
  validatePartial,
  validateStrict,
  formatZodError,
  formatValidationErrors,
  getFirstError,
  makeOptional,
  validateAsync,
  validateAsyncOrThrow,
  type ValidationError,
  type ValidationResult,
} from './validate.js'

// Re-export zod for convenience
export { z } from 'zod'
