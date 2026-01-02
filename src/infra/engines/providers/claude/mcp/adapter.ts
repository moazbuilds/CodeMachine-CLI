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
    debug('[MCP:claude] Configuring workflow-signals (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      // Initialize mcpServers if not present
      data.mcpServers = data.mcpServers || {};

      // Add/update workflow-signals MCP server
      data.mcpServers['workflow-signals'] = settings.getWorkflowSignalsConfig(workflowDir);

      await settings.writeSettings(settingsPath, data);
      debug('[MCP:claude] Configuration complete');
    } catch (error) {
      throw new MCPConfigError(
        `Failed to configure: ${(error as Error).message}`,
        'claude',
        error as Error
      );
    }
  },

  async cleanup(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:claude] Cleaning up workflow-signals (scope: %s)', scope);

    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);

      if (data.mcpServers && 'workflow-signals' in data.mcpServers) {
        delete data.mcpServers['workflow-signals'];
        await settings.writeSettings(settingsPath, data);
        debug('[MCP:claude] Cleanup complete');
      } else {
        debug('[MCP:claude] No workflow-signals config to cleanup');
      }
    } catch (error) {
      // Ignore cleanup errors - file might not exist
      debug('[MCP:claude] Cleanup error (ignored): %s', (error as Error).message);
    }
  },

  async isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean> {
    try {
      const settingsPath = settings.getSettingsPath(scope, workflowDir);
      const data = await settings.readSettings(settingsPath);
      const configured = !!(data.mcpServers && 'workflow-signals' in data.mcpServers);
      debug('[MCP:claude] isConfigured: %s', configured);
      return configured;
    } catch {
      return false;
    }
  },
};
