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
    debug('[MCP:ccr] Configuring MCP router (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      data.mcpServers = data.mcpServers || {};
      data.mcpServers[settings.ROUTER_ID] = settings.getMCPRouterConfig(workflowDir);

      await settings.writeSettings(settingsPath, data);
      debug('[MCP:ccr] Configuration complete (router: %s)', settings.ROUTER_ID);
    } catch (error) {
      throw new MCPConfigError(
        `Failed to configure: ${(error as Error).message}`,
        'ccr',
        error as Error
      );
    }
  },

  async cleanup(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:ccr] Cleaning up MCP configuration (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      if (data.mcpServers && settings.ROUTER_ID in data.mcpServers) {
        delete data.mcpServers[settings.ROUTER_ID];
        await settings.writeSettings(settingsPath, data);
        debug('[MCP:ccr] Cleanup complete');
      } else {
        debug('[MCP:ccr] No MCP configuration to cleanup');
      }
    } catch (error) {
      debug('[MCP:ccr] Cleanup error (ignored): %s', (error as Error).message);
    }
  },

  async isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean> {
    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);
      const configured = !!(data.mcpServers && settings.ROUTER_ID in data.mcpServers);
      debug('[MCP:ccr] isConfigured: %s', configured);
      return configured;
    } catch {
      return false;
    }
  },
};
