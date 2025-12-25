/**
 * OpenCode Engine MCP Configuration
 *
 * Provides MCP server configuration for workflow signals integration.
 * This enables agents to use structured tool calls for workflow orchestration.
 */

import type { EngineMCPConfig } from '../../core/base.js';
import {
  configureOpenCodeMCP,
  removeOpenCodeMCP,
  isOpenCodeMCPConfigured,
  getOpenCodeSettingsPath,
} from '../../../mcp/index.js';

/**
 * Configure MCP servers for OpenCode
 */
async function configure(_workflowDir: string): Promise<void> {
  await configureOpenCodeMCP(_workflowDir, 'user');
}

/**
 * Remove MCP server configuration
 */
async function cleanup(_workflowDir: string): Promise<void> {
  await removeOpenCodeMCP(_workflowDir, 'user');
}

/**
 * Check if MCP is configured for OpenCode
 */
async function isConfigured(_workflowDir: string): Promise<boolean> {
  return isOpenCodeMCPConfigured(_workflowDir, 'user');
}

/**
 * MCP configuration for OpenCode engine
 */
export const mcp: EngineMCPConfig = {
  supported: true,
  configure,
  cleanup,
  isConfigured,
};
