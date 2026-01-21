/**
 * Auggie MCP Settings Management
 *
 * Read/write Auggie settings files (JSON format).
 * Uses AUGGIE_HOME for config path resolution.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { debug } from '../../../../../shared/logging/logger.js';
import type { ConfigScope } from '../../../../mcp/types.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { ENV } from '../config.js';
import { getRouterConfig, ROUTER_ID } from '../../../../mcp/router/config.js';

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Resolve AUGGIE_HOME directory
 * Uses CODEMACHINE_AUGGIE_HOME env var or defaults to ~/.codemachine/auggie
 */
export function resolveAuggieHome(): string {
  if (process.env[ENV.AUGGIE_HOME]) {
    return expandHomeDir(process.env[ENV.AUGGIE_HOME]!);
  }
  return path.join(homedir(), '.codemachine', 'auggie');
}

/**
 * Get Auggie settings file path
 *
 * @param scope - 'project' for project-level config, 'user' for AUGGIE_HOME/settings.json
 * @param projectDir - Project directory (required for 'project' scope)
 */
export function getSettingsPath(scope: ConfigScope, projectDir?: string): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, '.auggie', 'settings.json');
  }
  return path.join(resolveAuggieHome(), 'settings.json');
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

export interface AuggieSettings {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Read Auggie settings file
 */
export async function readSettings(settingsPath: string): Promise<AuggieSettings> {
  try {
    debug('[MCP:auggie] Reading settings from %s', settingsPath);
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as AuggieSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      debug('[MCP:auggie] Settings file not found, returning empty object');
      return {};
    }
    throw error;
  }
}

/**
 * Write Auggie settings file
 */
export async function writeSettings(settingsPath: string, settings: AuggieSettings): Promise<void> {
  debug('[MCP:auggie] Writing settings to %s', settingsPath);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

// ============================================================================
// MCP SERVER MANAGEMENT
// ============================================================================

/**
 * Get MCP router configuration for Auggie format
 */
export function getMCPRouterConfig(workingDir: string): MCPServerConfig {
  const config = getRouterConfig(workingDir);
  return {
    command: config.command,
    args: config.args,
    env: config.env,
  };
}

// Re-export router ID
export { ROUTER_ID };

/**
 * Add MCP router to settings
 */
export function addMCPServers(settings: AuggieSettings, workflowDir: string): AuggieSettings {
  return {
    ...settings,
    mcpServers: {
      ...settings.mcpServers,
      [ROUTER_ID]: getMCPRouterConfig(workflowDir),
    },
  };
}

/**
 * Remove codemachine MCP router from settings
 */
export function removeMCPServers(settings: AuggieSettings): AuggieSettings {
  if (!settings.mcpServers) {
    return settings;
  }

  const { [ROUTER_ID]: _, ...remainingServers } = settings.mcpServers;

  return {
    ...settings,
    mcpServers: Object.keys(remainingServers).length > 0 ? remainingServers : undefined,
  };
}

/**
 * Check if settings contain codemachine MCP router
 */
export function hasMCPServers(settings: AuggieSettings): boolean {
  return !!(settings.mcpServers?.[ROUTER_ID]);
}
