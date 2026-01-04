/**
 * CCR Settings Management
 *
 * Read/write CCR settings files (JSON format).
 * Handles both project-scope (.ccr/settings.json) and user-scope files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { debug } from '../../../../../shared/logging/logger.js';
import type { ConfigScope, MCPServerConfig } from '../../../../mcp/types.js';
import { getServerPath as getWorkflowSignalsPath } from '../../../../mcp/servers/workflow-signals/config.js';
import { getServerPath as getAgentCoordinationPath } from '../../../../mcp/servers/agent-coordination/config.js';
import { ENV } from '../config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CCRSettings {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Get CCR MCP settings file path
 *
 * CCR reads MCP configuration from:
 * - Project scope: .mcp.json in project directory
 * - User scope: .ccr.json in CCR_HOME (defaults to ~/.codemachine/ccr)
 *
 * @param scope - 'project' for .mcp.json, 'user' for .ccr.json
 * @param projectDir - Project directory (required for 'project' scope)
 */
export function getSettingsPath(scope: ConfigScope, projectDir?: string): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, '.mcp.json');
  }
  // User scope: CCR reads from .ccr.json in CCR_HOME
  const envHome = process.env[ENV.CCR_HOME];
  const ccrConfigDir = envHome ?? path.join(homedir(), '.codemachine', 'ccr');
  return path.join(ccrConfigDir, '.ccr.json');
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Read CCR settings
 */
export async function readSettings(settingsPath: string): Promise<CCRSettings> {
  try {
    debug('[MCP:ccr] Reading settings from %s', settingsPath);
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as CCRSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      debug('[MCP:ccr] Settings file not found, returning empty object');
      return {};
    }
    throw error;
  }
}

/**
 * Write CCR settings
 */
export async function writeSettings(
  settingsPath: string,
  settings: CCRSettings
): Promise<void> {
  debug('[MCP:ccr] Writing settings to %s', settingsPath);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

// ============================================================================
// MCP CONFIG GENERATION
// ============================================================================

/**
 * Get MCP server configuration for CCR format
 *
 * CCR uses: { command, args, env }
 */
export function getWorkflowSignalsConfig(workflowDir: string): MCPServerConfig {
  return {
    command: 'bun',
    args: ['run', getWorkflowSignalsPath()],
    env: {
      WORKFLOW_DIR: workflowDir,
    },
  };
}

/**
 * Get agent-coordination MCP server configuration for CCR format
 */
export function getAgentCoordinationConfig(workingDir: string): MCPServerConfig {
  return {
    command: 'bun',
    args: ['run', getAgentCoordinationPath()],
    env: {
      CODEMACHINE_WORKING_DIR: workingDir,
    },
  };
}
