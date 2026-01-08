/**
 * GitHub Copilot Engine
 *
 * Provides GitHub Copilot integration with CodeMachine's engine runtime.
 * Uses device code flow for authentication (same as IDE plugins).
 */

import type { EngineModule } from '../../core/base.js';
import { metadata } from './metadata.js';
import * as auth from './auth.js';
import { runCopilot } from './execution/index.js';

export * from './auth.js';
export * from './config.js';
export * from './execution/index.js';
export { metadata };

export default {
  metadata,
  auth,
  run: runCopilot,
} satisfies EngineModule;
