/**
 * OpenCode MCP Adapter
 *
 * Implements MCPAdapter interface for OpenCode.
 * Manages workflow-signals MCP server configuration in OpenCode's settings.
 */

import { debug } from '../../../../../shared/logging/logger.js';
import type { MCPAdapter, ConfigScope } from '../../../../mcp/types.js';
import { MCPConfigError } from '../../../../mcp/errors.js';
import * as settings from './settings.js';

// ============================================================================
// ADAPTER
// ============================================================================

export const opencodeAdapter: MCPAdapter = {
  id: 'opencode',
  name: 'OpenCode',

  getSettingsPath: settings.getSettingsPath,

  async configure(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:opencode] Configuring MCP servers (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      // Initialize mcp if not present
      data.mcp = data.mcp || {};

      // Add/update MCP servers
      data.mcp['workflow-signals'] = settings.getWorkflowSignalsConfig();
      data.mcp['agent-coordination'] = settings.getAgentCoordinationConfig();

      await settings.writeSettings(settingsPath, data);
      debug('[MCP:opencode] Configuration complete (workflow-signals, agent-coordination)');
    } catch (error) {
      throw new MCPConfigError(
        `Failed to configure: ${(error as Error).message}`,
        'opencode',
        error as Error
      );
    }
  },

  async cleanup(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:opencode] Cleaning up MCP servers (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      let cleaned = false;
      if (data.mcp) {
        if ('workflow-signals' in data.mcp) {
          delete data.mcp['workflow-signals'];
          cleaned = true;
        }
        if ('agent-coordination' in data.mcp) {
          delete data.mcp['agent-coordination'];
          cleaned = true;
        }
      }

      if (cleaned) {
        await settings.writeSettings(settingsPath, data);
        debug('[MCP:opencode] Cleanup complete');
      } else {
        debug('[MCP:opencode] No MCP servers to cleanup');
      }
    } catch (error) {
      // Ignore cleanup errors - file might not exist
      debug('[MCP:opencode] Cleanup error (ignored): %s', (error as Error).message);
    }
  },

  async isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean> {
    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);
      // Check if at least one of our servers is configured
      const configured = !!(
        data.mcp &&
        ('workflow-signals' in data.mcp || 'agent-coordination' in data.mcp)
      );
      debug('[MCP:opencode] isConfigured: %s', configured);
      return configured;
    } catch {
      return false;
    }
  },
};
