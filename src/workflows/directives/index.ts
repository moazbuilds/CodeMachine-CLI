/**
 * Directives Module
 *
 * Agent-issued instructions that control workflow execution.
 * Agents write to directive.json to issue directives.
 *
 * Supported directives:
 * - loop: Repeat steps
 * - checkpoint: Pause for user confirmation
 * - trigger: Execute another agent
 * - error: Report workflow error
 * - pause: Agent requests pause (different from user keypress)
 *
 * Note: skip logic moved to step/skip.ts
 * Note: signal manager moved to signals/manager
 */

export * from './types.js';
export * from './reader.js';
export * from './onAdvance.js';
export * from './loop/index.js';
export * from './trigger/index.js';
export * from './checkpoint/index.js';
export * from './error/index.js';
export * from './pause/index.js';
