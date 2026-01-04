/**
 * Mistral Vibe Engine MCP Configuration
 *
 * Entry point for Mistral's MCP adapter.
 * Registers adapter with central registry and exports EngineMCPConfig.
 */

import type { EngineMCPConfig } from '../../../core/base.js';
import { adapterRegistry } from '../../../../mcp/registry.js';
import { mistralAdapter } from './adapter.js';

// ============================================================================
// REGISTER ADAPTER
// ============================================================================

adapterRegistry.register(mistralAdapter);

// ============================================================================
// ENGINE MCP CONFIG
// ============================================================================

export const mcp: EngineMCPConfig = {
  supported: true,
  configure: (workflowDir) => mistralAdapter.configure(workflowDir, 'user'),
  cleanup: (workflowDir) => mistralAdapter.cleanup(workflowDir, 'user'),
  isConfigured: (workflowDir) => mistralAdapter.isConfigured(workflowDir, 'user'),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { mistralAdapter };
export {
  getSettingsPath,
  resolveVibeHome,
  readConfig,
  writeConfig,
  generateWorkflowSignalsSection,
  generateAgentCoordinationSection,
  generateAllMCPSections,
  removeAllMCPSections,
  hasMCPSections,
} from './settings.js';
