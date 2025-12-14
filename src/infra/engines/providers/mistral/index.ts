/**
 * Mistral Engine
 *
 * Provides Mistral Vibe CLI integration with similar interface to Claude and Codex engines.
 * Supports model mapping and authentication management.
 */

import type { EngineModule } from '../../core/base.js';
import { metadata } from './metadata.js';
import * as auth from './auth.js';
import { runMistral } from './execution/index.js';

// Export all sub-modules
export * from './auth.js';
export * from './config.js';
export * from './execution/index.js';
export { metadata };

// Export as EngineModule for auto-discovery
export default {
  metadata,
  auth,
  run: runMistral,
} satisfies EngineModule;

