/**
 * Codex Engine MCP Configuration
 *
 * Entry point for Codex's MCP adapter.
 * Registers adapter with central registry and exports EngineMCPConfig.
 */

import type { EngineMCPConfig } from '../../../core/base.js';
import { adapterRegistry } from '../../../../mcp/registry.js';
import { codexAdapter } from './adapter.js';

// ============================================================================
// REGISTER ADAPTER
// ============================================================================

adapterRegistry.register(codexAdapter);

// ============================================================================
// ENGINE MCP CONFIG
// ============================================================================

export const mcp: EngineMCPConfig = {
  supported: true,
  configure: (workflowDir) => codexAdapter.configure(workflowDir, 'user'),
  cleanup: (workflowDir) => codexAdapter.cleanup(workflowDir, 'user'),
  isConfigured: (workflowDir) => codexAdapter.isConfigured(workflowDir, 'user'),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { codexAdapter };
export {
  getSettingsPath,
  readConfig,
  writeConfig,
  generateWorkflowSignalsSection,
  generateAgentCoordinationSection,
  generateAllMCPSections,
  removeAllMCPSections,
  hasMCPSections,
} from './settings.js';
