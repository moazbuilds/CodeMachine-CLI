/**
 * Cursor Engine
 *
 * Provides Cursor AI CLI integration with similar interface to Claude and Codex engines.
 * Supports model mapping and authentication management.
 */

import type { EngineModule } from '../../core/base.js';
import { metadata } from './metadata.js';
import * as auth from './auth.js';
import { runCursor } from './execution/index.js';
import { mcp } from './mcp/index.js';

// Export all sub-modules
export * from './auth.js';
export * from './config.js';
export * from './execution/index.js';
export * from './mcp/index.js';
export { metadata };

// Export as EngineModule for auto-discovery
export default {
  metadata,
  auth,
  run: runCursor,
  mcp,
} satisfies EngineModule;
