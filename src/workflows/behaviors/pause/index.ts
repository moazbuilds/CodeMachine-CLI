/**
 * Pause Behavior Module
 *
 * Handles workflow pause signals from:
 * - User keypress (workflow:pause event)
 * - Agent writing { action: 'pause' } to behavior.json
 */

export * from './types.js';
export * from './evaluator.js';
export * from './handler.js';
export * from './listener.js';
