/**
 * CCR Engine MCP Configuration
 *
 * Entry point for CCR's MCP adapter.
 * Registers adapter with central registry and exports EngineMCPConfig.
 */

import type { EngineMCPConfig } from '../../../core/base.js';
import { adapterRegistry } from '../../../../mcp/registry.js';
import { ccrAdapter } from './adapter.js';

// ============================================================================
// REGISTER ADAPTER
// ============================================================================

adapterRegistry.register(ccrAdapter);

// ============================================================================
// ENGINE MCP CONFIG
// ============================================================================

export const mcp: EngineMCPConfig = {
  supported: true,
  configure: (workflowDir) => ccrAdapter.configure(workflowDir, 'user'),
  cleanup: (workflowDir) => ccrAdapter.cleanup(workflowDir, 'user'),
  isConfigured: (workflowDir) => ccrAdapter.isConfigured(workflowDir, 'user'),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { ccrAdapter };
export { getSettingsPath, readSettings, writeSettings } from './settings.js';
