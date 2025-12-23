/**
 * Workflow Context Module
 *
 * Centralized context management for workflow execution.
 * Import from this module to access context types and utilities.
 */

// Types
export type {
  StepContext,
  InputContext,
  InputResult,
} from './types.js';

// Utilities
export {
  getUniqueAgentId,
  createStepContext,
  createInputContext,
  updateStepContext,
  type CreateStepContextOptions,
} from './step.js';
