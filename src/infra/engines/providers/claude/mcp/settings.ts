/**
 * Claude Settings Management
 *
 * Read/write Claude Code settings files (JSON format).
 * Handles both project-scope (.claude/settings.json) and user-scope files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { debug } from '../../../../../shared/logging/logger.js';
import type { ConfigScope, MCPServerConfig } from '../../../../mcp/types.js';
import { getServerPath as getWorkflowSignalsPath } from '../../../../mcp/servers/workflow-signals/config.js';
import { getServerPath as getAgentCoordinationPath } from '../../../../mcp/servers/agent-coordination/config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ClaudeSettings {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Get Claude Code settings file path
 *
 * @param scope - 'project' for .claude/settings.json, 'user' for ~/.codemachine/claude/settings.json
 * @param projectDir - Project directory (required for 'project' scope)
 */
export function getSettingsPath(scope: ConfigScope, projectDir?: string): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, '.claude', 'settings.json');
  }
  return path.join(homedir(), '.codemachine', 'claude', 'settings.json');
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Read Claude Code settings
 */
export async function readSettings(settingsPath: string): Promise<ClaudeSettings> {
  try {
    debug('[MCP:claude] Reading settings from %s', settingsPath);
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as ClaudeSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      debug('[MCP:claude] Settings file not found, returning empty object');
      return {};
    }
    throw error;
  }
}

/**
 * Write Claude Code settings
 */
export async function writeSettings(
  settingsPath: string,
  settings: ClaudeSettings
): Promise<void> {
  debug('[MCP:claude] Writing settings to %s', settingsPath);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

// ============================================================================
// MCP CONFIG GENERATION
// ============================================================================

/**
 * Get MCP server configuration for Claude format
 *
 * Claude uses: { command, args, env }
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
 * Get agent-coordination MCP server configuration for Claude format
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
