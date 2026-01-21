/**
 * Cursor Engine MCP Configuration
 *
 * Entry point for Cursor's MCP adapter.
 * Registers adapter with central registry and exports EngineMCPConfig.
 */

import type { EngineMCPConfig } from '../../../core/base.js';
import { adapterRegistry } from '../../../../mcp/registry.js';
import { cursorAdapter } from './adapter.js';

// ============================================================================
// REGISTER ADAPTER
// ============================================================================

adapterRegistry.register(cursorAdapter);

// ============================================================================
// ENGINE MCP CONFIG
// ============================================================================

export const mcp: EngineMCPConfig = {
  supported: true,
  configure: (workflowDir) => cursorAdapter.configure(workflowDir, 'user'),
  cleanup: (workflowDir) => cursorAdapter.cleanup(workflowDir, 'user'),
  isConfigured: (workflowDir) => cursorAdapter.isConfigured(workflowDir, 'user'),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { cursorAdapter };
export {
  getSettingsPath,
  resolveCursorHome,
  readConfig,
  writeConfig,
  getMCPRouterConfig,
  ROUTER_ID,
  addMCPServers,
  removeMCPServers,
  hasMCPServers,
} from './settings.js';
export type { CursorMCPConfig, MCPServerConfig } from './settings.js';
