/**
 * CCR MCP Adapter
 *
 * Implements MCPAdapter interface for CCR (Claude Code Router).
 * Manages workflow-signals MCP server configuration in CCR's settings.
 */

import { debug } from '../../../../../shared/logging/logger.js';
import type { MCPAdapter, ConfigScope } from '../../../../mcp/types.js';
import { MCPConfigError } from '../../../../mcp/errors.js';
import * as settings from './settings.js';

// ============================================================================
// ADAPTER
// ============================================================================

export const ccrAdapter: MCPAdapter = {
  id: 'ccr',
  name: 'CCR (Claude Code Router)',

  getSettingsPath: settings.getSettingsPath,

  async configure(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:ccr] Configuring MCP servers (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      // Initialize mcpServers if not present
      data.mcpServers = data.mcpServers || {};

      // Add/update workflow-signals MCP server
      data.mcpServers['workflow-signals'] = settings.getWorkflowSignalsConfig(workflowDir);

      // Add/update agent-coordination MCP server
      data.mcpServers['agent-coordination'] = settings.getAgentCoordinationConfig(workflowDir);

      await settings.writeSettings(settingsPath, data);
      debug('[MCP:ccr] Configuration complete (workflow-signals, agent-coordination)');
    } catch (error) {
      throw new MCPConfigError(
        `Failed to configure: ${(error as Error).message}`,
        'ccr',
        error as Error
      );
    }
  },

  async cleanup(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:ccr] Cleaning up MCP servers (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      let cleaned = false;
      if (data.mcpServers) {
        if ('workflow-signals' in data.mcpServers) {
          delete data.mcpServers['workflow-signals'];
          cleaned = true;
        }
        if ('agent-coordination' in data.mcpServers) {
          delete data.mcpServers['agent-coordination'];
          cleaned = true;
        }
      }

      if (cleaned) {
        await settings.writeSettings(settingsPath, data);
        debug('[MCP:ccr] Cleanup complete');
      } else {
        debug('[MCP:ccr] No MCP servers to cleanup');
      }
    } catch (error) {
      // Ignore cleanup errors - file might not exist
      debug('[MCP:ccr] Cleanup error (ignored): %s', (error as Error).message);
    }
  },

  async isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean> {
    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);
      // Check if at least one of our servers is configured
      const configured = !!(
        data.mcpServers &&
        ('workflow-signals' in data.mcpServers || 'agent-coordination' in data.mcpServers)
      );
      debug('[MCP:ccr] isConfigured: %s', configured);
      return configured;
    } catch {
      return false;
    }
  },
};
