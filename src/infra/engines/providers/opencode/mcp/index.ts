/**
 * OpenCode Engine MCP Configuration
 *
 * Entry point for OpenCode's MCP adapter.
 * Registers adapter with central registry and exports EngineMCPConfig.
 */

import type { EngineMCPConfig } from '../../../core/base.js';
import { adapterRegistry } from '../../../../mcp/registry.js';
import { opencodeAdapter } from './adapter.js';

// ============================================================================
// REGISTER ADAPTER
// ============================================================================

adapterRegistry.register(opencodeAdapter);

// ============================================================================
// ENGINE MCP CONFIG
// ============================================================================

export const mcp: EngineMCPConfig = {
  supported: true,
  configure: (workflowDir) => opencodeAdapter.configure(workflowDir, 'user'),
  cleanup: (workflowDir) => opencodeAdapter.cleanup(workflowDir, 'user'),
  isConfigured: (workflowDir) => opencodeAdapter.isConfigured(workflowDir, 'user'),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { opencodeAdapter };
export {
  getSettingsPath,
  readSettings,
  writeSettings,
  getWorkflowSignalsConfig,
  getAgentCoordinationConfig,
  type OpenCodeMCPServer,
  type OpenCodeSettings,
} from './settings.js';
