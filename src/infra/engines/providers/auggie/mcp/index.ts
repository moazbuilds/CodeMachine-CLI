/**
 * Auggie Engine MCP Configuration
 *
 * Entry point for Auggie's MCP adapter.
 * Registers adapter with central registry and exports EngineMCPConfig.
 */

import type { EngineMCPConfig } from '../../../core/base.js';
import { adapterRegistry } from '../../../../mcp/registry.js';
import { auggieAdapter } from './adapter.js';

// ============================================================================
// REGISTER ADAPTER
// ============================================================================

adapterRegistry.register(auggieAdapter);

// ============================================================================
// ENGINE MCP CONFIG
// ============================================================================

export const mcp: EngineMCPConfig = {
  supported: true,
  configure: (workflowDir) => auggieAdapter.configure(workflowDir, 'user'),
  cleanup: (workflowDir) => auggieAdapter.cleanup(workflowDir, 'user'),
  isConfigured: (workflowDir) => auggieAdapter.isConfigured(workflowDir, 'user'),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { auggieAdapter };
export {
  getSettingsPath,
  readSettings,
  writeSettings,
  generateWorkflowSignalsConfig,
  generateAgentCoordinationConfig,
  addMCPServers,
  removeMCPServers,
  hasMCPServers,
} from './settings.js';
export type { AuggieSettings, MCPServerConfig } from './settings.js';
