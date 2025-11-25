/**
 * UI Adapters Module
 *
 * Provides different UI implementations for workflow visualization:
 * - HeadlessAdapter: Console/file logging (CI, automation)
 * - MockAdapter: Event recording (testing)
 * - OpenTUIAdapter: Visual TUI (interactive use)
 */

export * from './types.js';
export * from './base.js';
export * from './headless.js';
export * from './mock.js';
export * from './opentui.js';

import type { IWorkflowUI, UIAdapterOptions, AdapterType } from './types.js';
import { HeadlessAdapter, type HeadlessAdapterOptions } from './headless.js';
import { MockAdapter } from './mock.js';
import { OpenTUIAdapter, type UIActions, type OpenTUIAdapterOptions } from './opentui.js';

/**
 * Create a UI adapter by type
 *
 * @param type - Adapter type: 'opentui' | 'headless' | 'mock'
 * @param options - Adapter configuration
 * @returns UI adapter instance
 *
 * @example
 * ```typescript
 * // Headless for CI
 * const ui = createAdapter('headless', { logLevel: 'normal' });
 *
 * // Mock for tests
 * const ui = createAdapter('mock');
 *
 * // OpenTUI for interactive
 * const ui = createAdapter('opentui', { actions: uiActions });
 * ```
 */
export function createAdapter(
  type: AdapterType,
  options?: UIAdapterOptions & HeadlessAdapterOptions & { actions?: UIActions }
): IWorkflowUI {
  switch (type) {
    case 'headless':
      return new HeadlessAdapter(options);

    case 'mock':
      return new MockAdapter(options);

    case 'opentui':
      if (!options?.actions) {
        // Fall back to headless if no UI actions provided
        console.warn('[createAdapter] OpenTUI requires actions, using headless');
        return new HeadlessAdapter(options);
      }
      return new OpenTUIAdapter({ ...options, actions: options.actions });

    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}

/**
 * Create the appropriate adapter based on environment
 *
 * - TTY available → OpenTUI (when implemented) or Headless
 * - No TTY (CI, pipes) → Headless
 * - Test environment → Mock
 *
 * @param options - Adapter configuration
 * @returns UI adapter instance
 */
export function createAutoAdapter(
  options?: UIAdapterOptions & HeadlessAdapterOptions
): IWorkflowUI {
  // Check for test environment
  if (process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test') {
    return new MockAdapter(options);
  }

  // Check for TTY
  if (!process.stdout.isTTY) {
    return new HeadlessAdapter(options);
  }

  // For now, use headless even with TTY
  // TODO: Return OpenTUI adapter when implemented in Phase 6
  return new HeadlessAdapter(options);
}
