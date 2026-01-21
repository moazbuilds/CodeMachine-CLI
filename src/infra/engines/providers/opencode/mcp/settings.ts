/**
 * OpenCode Settings Management
 *
 * Read/write OpenCode config files (JSON format).
 * Handles both project-scope (opencode.json) and user-scope files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { debug } from '../../../../../shared/logging/logger.js';
import type { ConfigScope } from '../../../../mcp/types.js';
import { getRouterPath, ROUTER_ID } from '../../../../mcp/router/config.js';
import { resolveOpenCodeHome } from '../auth.js';

// Re-export router ID
export { ROUTER_ID };

// ============================================================================
// TYPES
// ============================================================================

export interface OpenCodeMCPServer {
  type: 'local' | 'remote';
  command?: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

export interface OpenCodeSettings {
  $schema?: string;
  mcp?: Record<string, OpenCodeMCPServer>;
  [key: string]: unknown;
}

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Get OpenCode config file path
 *
 * @param scope - 'project' for opencode.json, 'user' for ~/.codemachine/opencode/.../opencode.json
 * @param projectDir - Project directory (required for 'project' scope)
 */
export function getSettingsPath(scope: ConfigScope, projectDir?: string): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, 'opencode.json');
  }
  return path.join(
    resolveOpenCodeHome(),
    'config',
    'opencode',
    'opencode.json'
  );
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Read OpenCode settings
 */
export async function readSettings(settingsPath: string): Promise<OpenCodeSettings> {
  try {
    debug('[MCP:opencode] Reading settings from %s', settingsPath);
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as OpenCodeSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      debug('[MCP:opencode] Settings file not found, returning empty object');
      return {};
    }
    throw error;
  }
}

/**
 * Write OpenCode settings
 */
export async function writeSettings(
  settingsPath: string,
  settings: OpenCodeSettings
): Promise<void> {
  debug('[MCP:opencode] Writing settings to %s', settingsPath);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

// ============================================================================
// MCP CONFIG GENERATION
// ============================================================================

/**
 * Get MCP router configuration for OpenCode format
 *
 * OpenCode uses: { type, command[], enabled }
 */
export function getMCPRouterConfig(): OpenCodeMCPServer {
  return {
    type: 'local',
    command: ['bun', 'run', getRouterPath()],
    enabled: true,
  };
}
