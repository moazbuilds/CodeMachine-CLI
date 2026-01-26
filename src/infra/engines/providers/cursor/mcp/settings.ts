/**
 * Cursor MCP Settings Management
 *
 * Read/write Cursor MCP config files (JSON format).
 * Uses CURSOR_HOME for config path resolution.
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
 * Resolve CURSOR_HOME directory
 * Uses CODEMACHINE_CURSOR_HOME env var or defaults to ~/.codemachine/cursor
 */
export function resolveCursorHome(): string {
  if (process.env[ENV.CURSOR_HOME]) {
    return expandHomeDir(process.env[ENV.CURSOR_HOME]!);
  }
  return path.join(homedir(), '.codemachine', 'cursor');
}

/**
 * Get Cursor MCP config file path
 *
 * @param scope - 'project' for .cursor/mcp.json, 'user' for CURSOR_HOME/mcp.json
 * @param projectDir - Project directory (required for 'project' scope)
 */
export function getSettingsPath(scope: ConfigScope, projectDir?: string): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, '.cursor', 'mcp.json');
  }
  return path.join(resolveCursorHome(), 'mcp.json');
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

export interface CursorMCPConfig {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Read Cursor MCP config file
 */
export async function readConfig(configPath: string): Promise<CursorMCPConfig> {
  try {
    debug('[MCP:cursor] Reading config from %s', configPath);
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as CursorMCPConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      debug('[MCP:cursor] Config file not found, returning empty object');
      return {};
    }
    throw error;
  }
}

/**
 * Write Cursor MCP config file
 */
export async function writeConfig(configPath: string, config: CursorMCPConfig): Promise<void> {
  debug('[MCP:cursor] Writing config to %s', configPath);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
}

// ============================================================================
// MCP SERVER MANAGEMENT
// ============================================================================

/**
 * Get MCP router configuration for Cursor format
 *
 * The router now runs as `codemachine mcp router` and uses process.cwd()
 * for the working directory, eliminating the need for path parameters.
 */
export function getMCPRouterConfig(): MCPServerConfig {
  const config = getRouterConfig();
  return {
    command: config.command,
    args: config.args,
    env: config.env,
  };
}

// Re-export router ID
export { ROUTER_ID };

/**
 * Add MCP router to config
 */
export function addMCPServers(config: CursorMCPConfig): CursorMCPConfig {
  return {
    ...config,
    mcpServers: {
      ...config.mcpServers,
      [ROUTER_ID]: getMCPRouterConfig(),
    },
  };
}

/**
 * Remove codemachine MCP router from config
 */
export function removeMCPServers(config: CursorMCPConfig): CursorMCPConfig {
  if (!config.mcpServers) {
    return config;
  }

  const { [ROUTER_ID]: _, ...remainingServers } = config.mcpServers;

  return {
    ...config,
    mcpServers: Object.keys(remainingServers).length > 0 ? remainingServers : undefined,
  };
}

/**
 * Check if config contains codemachine MCP router
 */
export function hasMCPServers(config: CursorMCPConfig): boolean {
  return !!(config.mcpServers?.[ROUTER_ID]);
}
