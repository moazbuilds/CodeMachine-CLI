/**
 * Claude Engine
 *
 * Provides Claude Code CLI integration with similar interface to Codex engine.
 * Supports model mapping and authentication management.
 */

import type { EngineModule } from '../../core/base.js';
import { metadata } from './metadata.js';
import * as auth from './auth.js';
import { runClaude } from './execution/index.js';
import { mcp } from './mcp.js';

// Export all sub-modules
export * from './auth.js';
export * from './config.js';
export * from './execution/index.js';
export * from './mcp.js';
export { metadata };

// Export as EngineModule for auto-discovery
export default {
  metadata,
  auth,
  run: runClaude,
  mcp,
} satisfies EngineModule;
