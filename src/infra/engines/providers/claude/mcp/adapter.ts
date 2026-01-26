/**
 * Claude MCP Adapter
 *
 * Implements MCPAdapter interface for Claude Code.
 * Manages workflow-signals MCP server configuration in Claude's settings.
 */

import { debug } from '../../../../../shared/logging/logger.js';
import type { MCPAdapter, ConfigScope } from '../../../../mcp/types.js';
import { MCPConfigError } from '../../../../mcp/errors.js';
import * as settings from './settings.js';

// ============================================================================
// ADAPTER
// ============================================================================

export const claudeAdapter: MCPAdapter = {
  id: 'claude',
  name: 'Claude Code',

  getSettingsPath: settings.getSettingsPath,

  async configure(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:claude] Configuring MCP router (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      data.mcpServers = data.mcpServers || {};
      data.mcpServers[settings.ROUTER_ID] = settings.getMCPRouterConfig();

      await settings.writeSettings(settingsPath, data);
      debug('[MCP:claude] Configuration complete (router: %s)', settings.ROUTER_ID);
    } catch (error) {
      throw new MCPConfigError(
        `Failed to configure: ${(error as Error).message}`,
        'claude',
        error as Error
      );
    }
  },

  async cleanup(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:claude] Cleaning up MCP configuration (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      if (data.mcpServers && settings.ROUTER_ID in data.mcpServers) {
        delete data.mcpServers[settings.ROUTER_ID];
        await settings.writeSettings(settingsPath, data);
        debug('[MCP:claude] Cleanup complete');
      } else {
        debug('[MCP:claude] No MCP configuration to cleanup');
      }
    } catch (error) {
      debug('[MCP:claude] Cleanup error (ignored): %s', (error as Error).message);
    }
  },

  async isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean> {
    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);
      // Check if the router is configured
      const configured = !!(data.mcpServers && settings.ROUTER_ID in data.mcpServers);
      debug('[MCP:claude] isConfigured: %s', configured);
      return configured;
    } catch {
      return false;
    }
  },
};
