/**
 * Auggie MCP Adapter
 *
 * Implements MCPAdapter interface for Auggie CLI.
 * Manages MCP server configuration in Auggie's JSON settings.
 */

import { debug } from '../../../../../shared/logging/logger.js';
import type { MCPAdapter, ConfigScope } from '../../../../mcp/types.js';
import { MCPConfigError } from '../../../../mcp/errors.js';
import * as settings from './settings.js';

// ============================================================================
// ADAPTER
// ============================================================================

export const auggieAdapter: MCPAdapter = {
  id: 'auggie',
  name: 'Auggie CLI',

  getSettingsPath: settings.getSettingsPath,

  async configure(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:auggie] Configuring MCP router (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const existingSettings = await settings.readSettings(settingsPath);

      // Add MCP router to settings
      const updatedSettings = settings.addMCPServers(existingSettings, workflowDir);

      await settings.writeSettings(settingsPath, updatedSettings);
      debug('[MCP:auggie] Configuration complete (router: %s)', settings.ROUTER_ID);
    } catch (error) {
      throw new MCPConfigError(
        `Failed to configure: ${(error as Error).message}`,
        'auggie',
        error as Error
      );
    }
  },

  async cleanup(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:auggie] Cleaning up MCP servers (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const existingSettings = await settings.readSettings(settingsPath);

      if (!settings.hasMCPServers(existingSettings)) {
        debug('[MCP:auggie] No MCP servers to cleanup');
        return;
      }

      const cleanedSettings = settings.removeMCPServers(existingSettings);
      await settings.writeSettings(settingsPath, cleanedSettings);
      debug('[MCP:auggie] Cleanup complete');
    } catch (error) {
      // Ignore cleanup errors - file might not exist
      debug('[MCP:auggie] Cleanup error (ignored): %s', (error as Error).message);
    }
  },

  async isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean> {
    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const existingSettings = await settings.readSettings(settingsPath);
      const configured = settings.hasMCPServers(existingSettings);
      debug('[MCP:auggie] isConfigured: %s', configured);
      return configured;
    } catch {
      return false;
    }
  },
};
