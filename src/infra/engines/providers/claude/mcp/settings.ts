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
import { getRouterConfig, ROUTER_ID } from '../../../../mcp/router/config.js';

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
 * Get Claude Code MCP settings file path
 *
 * Claude reads MCP configuration from:
 * - Project scope: .mcp.json in project directory
 * - User scope: .claude.json in CLAUDE_CONFIG_DIR (defaults to ~/.codemachine/claude)
 *
 * @param scope - 'project' for .mcp.json, 'user' for .claude.json
 * @param projectDir - Project directory (required for 'project' scope)
 */
export function getSettingsPath(scope: ConfigScope, projectDir?: string): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, '.mcp.json');
  }
  // User scope: Claude reads from .claude.json in CLAUDE_CONFIG_DIR
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    ? process.env.CLAUDE_CONFIG_DIR
    : path.join(homedir(), '.codemachine', 'claude');
  return path.join(claudeConfigDir, '.claude.json');
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
 * Get MCP router configuration for Claude format
 *
 * The router aggregates tools from all backend servers (workflow-signals,
 * agent-coordination, and user-defined servers) into a single MCP server.
 *
 * The router now runs as `codemachine mcp router` and uses process.cwd()
 * for the working directory, eliminating the need for path parameters.
 *
 * Claude uses: { command, args, env }
 */
export function getMCPRouterConfig(): MCPServerConfig {
  return getRouterConfig();
}

// Re-export router ID for use in adapter
export { ROUTER_ID };
