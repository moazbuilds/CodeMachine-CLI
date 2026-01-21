/**
 * Codex Settings Management
 *
 * Read/write Codex config files (TOML format).
 * Handles both project-scope (.codex/config.toml) and user-scope files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { debug } from '../../../../../shared/logging/logger.js';
import type { ConfigScope } from '../../../../mcp/types.js';
import { getRouterPath, ROUTER_ID } from '../../../../mcp/router/config.js';

// Re-export router ID
export { ROUTER_ID };

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Get Codex config file path
 *
 * @param scope - 'project' for .codex/config.toml, 'user' for ~/.codemachine/codex/config.toml
 * @param projectDir - Project directory (required for 'project' scope)
 */
export function getSettingsPath(scope: ConfigScope, projectDir?: string): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, '.codex', 'config.toml');
  }
  return path.join(homedir(), '.codemachine', 'codex', 'config.toml');
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Read Codex config file content
 */
export async function readConfig(configPath: string): Promise<string> {
  try {
    debug('[MCP:codex] Reading config from %s', configPath);
    return await fs.readFile(configPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      debug('[MCP:codex] Config file not found, returning empty string');
      return '';
    }
    throw error;
  }
}

/**
 * Write Codex config file content
 */
export async function writeConfig(configPath: string, content: string): Promise<void> {
  debug('[MCP:codex] Writing config to %s', configPath);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, content.trim() + '\n');
}

// ============================================================================
// TOML SECTION MANAGEMENT
// ============================================================================

/**
 * Generate TOML section for MCP router
 *
 * Codex uses TOML format with: command, args, cwd, startup_timeout_sec, env
 */
export function generateRouterSection(workingDir: string): string {
  const routerPath = getRouterPath();

  const lines = [
    `[mcp_servers."${ROUTER_ID}"]`,
    'command = "bun"',
    `args = ["run", "${routerPath}"]`,
    'startup_timeout_sec = 60',
    '',
    `[mcp_servers."${ROUTER_ID}".env]`,
    `CODEMACHINE_WORKING_DIR = "${workingDir}"`,
  ];

  return lines.join('\n');
}

/**
 * Generate all MCP sections (just the router)
 */
export function generateAllMCPSections(workflowDir: string): string {
  return generateRouterSection(workflowDir);
}

/**
 * Remove codemachine MCP router section from TOML content
 */
export function removeAllMCPSections(content: string): string {
  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  let skipUntilNextSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is the router section
    if (trimmed.startsWith('[') && trimmed.includes(ROUTER_ID)) {
      skipUntilNextSection = true;
      continue;
    }

    // If we hit a new section that's NOT the router, stop skipping
    if (skipUntilNextSection && trimmed.startsWith('[') && !trimmed.includes(ROUTER_ID)) {
      skipUntilNextSection = false;
    }

    if (skipUntilNextSection) {
      continue;
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join('\n').trim();
}

/**
 * Check if config contains codemachine MCP router section
 */
export function hasMCPSections(content: string): boolean {
  return content.includes(`[mcp_servers."${ROUTER_ID}"]`);
}
