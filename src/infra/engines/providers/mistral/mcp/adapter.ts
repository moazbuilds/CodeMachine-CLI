/**
 * Mistral Vibe MCP Adapter
 *
 * Implements MCPAdapter interface for Mistral Vibe.
 * Manages MCP server configuration in Vibe's TOML config.
 */

import { debug } from '../../../../../shared/logging/logger.js';
import type { MCPAdapter, ConfigScope } from '../../../../mcp/types.js';
import { MCPConfigError } from '../../../../mcp/errors.js';
import * as settings from './settings.js';

// ============================================================================
// ADAPTER
// ============================================================================

export const mistralAdapter: MCPAdapter = {
  id: 'mistral',
  name: 'Mistral Vibe',

  getSettingsPath: settings.getSettingsPath,

  async configure(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:mistral] Configuring MCP servers (scope: %s)', scope);

    try {
      const configPath = settings.getSettingsPath(scope, workflowDir);
      const existingContent = await settings.readConfig(configPath);

      // Remove any existing MCP sections
      const cleanedContent = settings.removeAllMCPSections(existingContent);
      debug('[MCP:mistral] Cleaned existing MCP sections');

      // Generate new sections and combine
      const newSections = settings.generateAllMCPSections(workflowDir);
      const finalContent = cleanedContent
        ? cleanedContent + '\n\n' + newSections
        : newSections;

      await settings.writeConfig(configPath, finalContent);
      debug('[MCP:mistral] Configuration complete (workflow-signals, agent-coordination)');
    } catch (error) {
      throw new MCPConfigError(
        `Failed to configure: ${(error as Error).message}`,
        'mistral',
        error as Error
      );
    }
  },

  async cleanup(workflowDir: string, scope: ConfigScope): Promise<void> {
    debug('[MCP:mistral] Cleaning up MCP servers (scope: %s)', scope);

    try {
      const configPath = settings.getSettingsPath(scope, workflowDir);
      const existingContent = await settings.readConfig(configPath);

      if (!existingContent) {
        debug('[MCP:mistral] No config file to cleanup');
        return;
      }

      const cleanedContent = settings.removeAllMCPSections(existingContent);
      await settings.writeConfig(configPath, cleanedContent);
      debug('[MCP:mistral] Cleanup complete');
    } catch (error) {
      // Ignore cleanup errors - file might not exist
      debug('[MCP:mistral] Cleanup error (ignored): %s', (error as Error).message);
    }
  },

  async isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean> {
    try {
      const configPath = settings.getSettingsPath(scope, workflowDir);
      const content = await settings.readConfig(configPath);
      const configured = settings.hasMCPSections(content);
      debug('[MCP:mistral] isConfigured: %s', configured);
      return configured;
    } catch {
      return false;
    }
  },
};
