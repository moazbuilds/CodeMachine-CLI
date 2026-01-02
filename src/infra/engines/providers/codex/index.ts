import type { EngineModule } from '../../core/base.js';
import { metadata } from './metadata.js';
import * as auth from './auth.js';
import { runCodex } from './execution/index.js';
import { mcp } from './mcp/index.js';

// Export all sub-modules
export * from './execution/index.js';
export * from './auth.js';
export * from './mcp/index.js';
export { metadata };

// Export as EngineModule for auto-discovery
export default {
  metadata,
  auth,
  run: runCodex,
  mcp,
} satisfies EngineModule;
