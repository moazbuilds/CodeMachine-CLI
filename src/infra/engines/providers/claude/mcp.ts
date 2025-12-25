/**
 * Claude Engine MCP Configuration
 *
 * Provides MCP server configuration for workflow signals integration.
 * This enables Claude Code agents to use structured tool calls for workflow orchestration.
 */

import type { EngineMCPConfig } from '../../core/base.js';
import {
  configureClaudeMCP,
  removeClaudeMCP,
  isClaudeMCPConfigured,
} from '../../../mcp/index.js';

/**
 * Configure MCP servers for Claude Code
 */
async function configure(_workflowDir: string): Promise<void> {
  await configureClaudeMCP(_workflowDir, 'user');
}

/**
 * Remove MCP server configuration
 */
async function cleanup(_workflowDir: string): Promise<void> {
  await removeClaudeMCP(_workflowDir, 'user');
}

/**
 * Check if MCP is configured for Claude Code
 */
async function isConfigured(_workflowDir: string): Promise<boolean> {
  return isClaudeMCPConfigured(_workflowDir, 'user');
}

/**
 * MCP configuration for Claude engine
 */
export const mcp: EngineMCPConfig = {
  supported: true,
  configure,
  cleanup,
  isConfigured,
};
