/**
 * OpenCode Engine
 *
 * Provides OpenCode CLI integration with CodeMachine's engine runtime.
 */

import type { EngineModule } from '../../core/base.js';
import { metadata } from './metadata.js';
import * as auth from './auth.js';
import { runOpenCode } from './execution/index.js';
import { mcp } from './mcp/index.js';

export * from './auth.js';
export * from './config.js';
export * from './execution/index.js';
export * from './mcp/index.js';
export { metadata };

export default {
  metadata,
  auth,
  run: runOpenCode,
  mcp,
} satisfies EngineModule;
