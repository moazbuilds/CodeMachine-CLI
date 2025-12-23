/**
 * Workflow Signals Module
 *
 * User-initiated process events that control workflow execution:
 * - pause: Pause workflow execution
 * - skip: Skip current step
 * - stop: Stop workflow execution
 * - mode-change: Switch between user and auto input modes
 */

export * from './manager/index.js';
export * from './handlers/index.js';

// Re-export setAutoMode for direct use by runner
export { setAutoMode } from './handlers/mode.js';
