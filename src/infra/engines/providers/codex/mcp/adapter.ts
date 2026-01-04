/**
 * Codex MCP Adapter
 *
 * Implements MCPAdapter interface for Codex.
 * Manages workflow-signals MCP server configuration in Codex's TOML config.
 */

import { debug } from '../../../../../shared/logging/logger.js';
import type { MCPAdapter, ConfigScope } from '../../../../mcp/types.js';
import { MCPConfigError } from '../../../../mcp/errors.js';
import * as settings from './settings.js';

// ============================================================================
// ADAPTER
// ============================================================================

export const codexAdapter: MCPAdapter = {
  id: 'codex',
  name: 'Codex',

  getSettingsPath: settings.getSettingsPath,

  async configure(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:codex] Configuring MCP servers (scope: %s)', scope);

    try {
      const configPath = settings.getSettingsPath(scope, workflowDir);
      const existingContent = await settings.readConfig(configPath);

      // Remove any existing MCP sections
      const cleanedContent = settings.removeAllMCPSections(existingContent);
      debug('[MCP:codex] Cleaned existing MCP sections');

      // Generate new sections and combine
      const newSections = settings.generateAllMCPSections(workflowDir);
      const finalContent = cleanedContent
        ? cleanedContent + '\n\n' + newSections
        : newSections;

      await settings.writeConfig(configPath, finalContent);
      debug('[MCP:codex] Configuration complete (workflow-signals, agent-coordination)');
    } catch (error) {
      throw new MCPConfigError(
        `Failed to configure: ${(error as Error).message}`,
        'codex',
        error as Error
      );
    }
  },

  async cleanup(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:codex] Cleaning up MCP servers (scope: %s)', scope);

    try {
      const configPath = settings.getSettingsPath(scope, workflowDir);
      const existingContent = await settings.readConfig(configPath);

      if (!existingContent) {
        debug('[MCP:codex] No config file to cleanup');
        return;
      }

      const cleanedContent = settings.removeAllMCPSections(existingContent);
      await settings.writeConfig(configPath, cleanedContent);
      debug('[MCP:codex] Cleanup complete');
    } catch (error) {
      // Ignore cleanup errors - file might not exist
      debug('[MCP:codex] Cleanup error (ignored): %s', (error as Error).message);
    }
  },

  async isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean> {
    try {
      const configPath = settings.getSettingsPath(scope, workflowDir);
      const content = await settings.readConfig(configPath);
      const configured = settings.hasMCPSections(content);
      debug('[MCP:codex] isConfigured: %s', configured);
      return configured;
    } catch {
      return false;
    }
  },
};
