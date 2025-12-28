/**
 * Step Indexing Module
 *
 * Centralizes all step indexing, tracking, and resume functionality.
 * This is the single source of truth for workflow step state.
 */

// Main manager class
export { StepIndexManager } from './manager.js';

// Types
export type { StepData, QueuedPrompt, ResumeInfo, TemplateTracking, ControllerConfig } from './types.js';
export { StepLifecyclePhase, ResumeDecision } from './types.js';

// Lifecycle utilities
export { getStepPhase, isStepComplete, hasIncompleteChains, getNextChainIndex, isStepResumable } from './lifecycle.js';

// Debug utilities (for external use if needed)
export { logLifecycle, logResume, logQueue, logStepData, logDebug, logPersistence } from './debug.js';
