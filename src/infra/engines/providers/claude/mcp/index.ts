/**
 * Claude Engine MCP Configuration
 *
 * Entry point for Claude's MCP adapter.
 * Registers adapter with central registry and exports EngineMCPConfig.
 */

import type { EngineMCPConfig } from '../../../core/base.js';
import { adapterRegistry } from '../../../../mcp/registry.js';
import { claudeAdapter } from './adapter.js';

// ============================================================================
// REGISTER ADAPTER
// ============================================================================

adapterRegistry.register(claudeAdapter);

// ============================================================================
// ENGINE MCP CONFIG
// ============================================================================

export const mcp: EngineMCPConfig = {
  supported: true,
  configure: (workflowDir) => claudeAdapter.configure(workflowDir, 'user'),
  cleanup: (workflowDir) => claudeAdapter.cleanup(workflowDir, 'user'),
  isConfigured: (workflowDir) => claudeAdapter.isConfigured(workflowDir, 'user'),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { claudeAdapter };
export { getSettingsPath, readSettings, writeSettings } from './settings.js';
