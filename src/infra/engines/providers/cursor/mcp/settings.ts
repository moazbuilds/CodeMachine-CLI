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
import {
  getServerPath as getWorkflowSignalsPath,
} from '../../../../mcp/servers/workflow-signals/config.js';
import { getServerPath as getAgentCoordinationPath } from '../../../../mcp/servers/agent-coordination/config.js';

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
 * Generate workflow-signals MCP server config
 */
export function generateWorkflowSignalsConfig(workflowDir: string): MCPServerConfig {
  const serverPath = getWorkflowSignalsPath();

  return {
    command: 'bun',
    args: ['run', serverPath],
    env: {
      WORKFLOW_DIR: workflowDir,
    },
  };
}

/**
 * Generate agent-coordination MCP server config
 */
export function generateAgentCoordinationConfig(workingDir: string): MCPServerConfig {
  const serverPath = getAgentCoordinationPath();

  return {
    command: 'bun',
    args: ['run', serverPath],
    env: {
      CODEMACHINE_WORKING_DIR: workingDir,
    },
  };
}

/**
 * Add MCP servers to config
 */
export function addMCPServers(config: CursorMCPConfig, workflowDir: string): CursorMCPConfig {
  return {
    ...config,
    mcpServers: {
      ...config.mcpServers,
      'workflow-signals': generateWorkflowSignalsConfig(workflowDir),
      'agent-coordination': generateAgentCoordinationConfig(workflowDir),
    },
  };
}

/**
 * Remove codemachine MCP servers from config
 */
export function removeMCPServers(config: CursorMCPConfig): CursorMCPConfig {
  if (!config.mcpServers) {
    return config;
  }

  const { 'workflow-signals': _, 'agent-coordination': __, ...remainingServers } = config.mcpServers;

  return {
    ...config,
    mcpServers: Object.keys(remainingServers).length > 0 ? remainingServers : undefined,
  };
}

/**
 * Check if config contains codemachine MCP servers
 */
export function hasMCPServers(config: CursorMCPConfig): boolean {
  return !!(
    config.mcpServers?.['workflow-signals'] ||
    config.mcpServers?.['agent-coordination']
  );
}
