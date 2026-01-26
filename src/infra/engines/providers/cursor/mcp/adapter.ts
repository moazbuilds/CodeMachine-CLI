/**
 * Cursor MCP Adapter
 *
 * Implements MCPAdapter interface for Cursor IDE.
 * Manages MCP server configuration in Cursor's JSON config.
 */

import { debug } from '../../../../../shared/logging/logger.js';
import type { MCPAdapter, ConfigScope } from '../../../../mcp/types.js';
import { MCPConfigError } from '../../../../mcp/errors.js';
import * as settings from './settings.js';

// ============================================================================
// ADAPTER
// ============================================================================

export const cursorAdapter: MCPAdapter = {
  id: 'cursor',
  name: 'Cursor',

  getSettingsPath: settings.getSettingsPath,

  async configure(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:cursor] Configuring MCP router (scope: %s)', scope);

    try {
      const configPath = settings.getSettingsPath(scope, workflowDir);
      const existingConfig = await settings.readConfig(configPath);

      const updatedConfig = settings.addMCPServers(existingConfig);

      await settings.writeConfig(configPath, updatedConfig);
      debug('[MCP:cursor] Configuration complete (router: %s)', settings.ROUTER_ID);
    } catch (error) {
      throw new MCPConfigError(
        `Failed to configure: ${(error as Error).message}`,
        'cursor',
        error as Error
      );
    }
  },

  async cleanup(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:cursor] Cleaning up MCP servers (scope: %s)', scope);

    try {
      const configPath = settings.getSettingsPath(scope, workflowDir);
      const existingConfig = await settings.readConfig(configPath);

      if (!settings.hasMCPServers(existingConfig)) {
        debug('[MCP:cursor] No MCP servers to cleanup');
        return;
      }

      const cleanedConfig = settings.removeMCPServers(existingConfig);
      await settings.writeConfig(configPath, cleanedConfig);
      debug('[MCP:cursor] Cleanup complete');
    } catch (error) {
      // Ignore cleanup errors - file might not exist
      debug('[MCP:cursor] Cleanup error (ignored): %s', (error as Error).message);
    }
  },

  async isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean> {
    try {
      const configPath = settings.getSettingsPath(scope, workflowDir);
      const existingConfig = await settings.readConfig(configPath);
      const configured = settings.hasMCPServers(existingConfig);
      debug('[MCP:cursor] isConfigured: %s', configured);
      return configured;
    } catch {
      return false;
    }
  },
};
