/**
 * Mistral Vibe MCP Settings Management
 *
 * Read/write Vibe config files (TOML format).
 * Uses VIBE_HOME for config path resolution.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { debug } from '../../../../../shared/logging/logger.js';
import type { ConfigScope } from '../../../../mcp/types.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { ENV } from '../config.js';
import { getRouterPath, ROUTER_ID } from '../../../../mcp/router/config.js';

// Re-export router ID
export { ROUTER_ID };

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Resolve VIBE_HOME directory
 * Uses CODEMACHINE_MISTRAL_HOME env var or defaults to ~/.codemachine/vibe
 */
export function resolveVibeHome(): string {
  if (process.env[ENV.MISTRAL_HOME]) {
    return expandHomeDir(process.env[ENV.MISTRAL_HOME]!);
  }
  return path.join(homedir(), '.codemachine', 'vibe');
}

/**
 * Get Vibe config file path
 *
 * @param scope - 'project' for project-level config, 'user' for VIBE_HOME/config.toml
 * @param projectDir - Project directory (required for 'project' scope)
 */
export function getSettingsPath(scope: ConfigScope, projectDir?: string): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, '.vibe', 'config.toml');
  }
  return path.join(resolveVibeHome(), 'config.toml');
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Read Vibe config file content
 */
export async function readConfig(configPath: string): Promise<string> {
  try {
    debug('[MCP:mistral] Reading config from %s', configPath);
    return await fs.readFile(configPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      debug('[MCP:mistral] Config file not found, returning empty string');
      return '';
    }
    throw error;
  }
}

/**
 * Write Vibe config file content
 */
export async function writeConfig(configPath: string, content: string): Promise<void> {
  debug('[MCP:mistral] Writing config to %s', configPath);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, content.trim() + '\n');
}

// ============================================================================
// TOML SECTION MANAGEMENT
// ============================================================================

/**
 * Generate TOML section for MCP router
 *
 * Vibe uses [[mcp_servers]] array format with: name, transport, command, args
 */
export function generateRouterSection(workingDir: string): string {
  const routerPath = getRouterPath();

  const lines = [
    '[[mcp_servers]]',
    `name = "${ROUTER_ID}"`,
    'transport = "stdio"',
    'command = "bun"',
    `args = ["run", "${routerPath}"]`,
    '',
    '[mcp_servers.env]',
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this is a [[mcp_servers]] section
    if (trimmed === '[[mcp_servers]]') {
      const nextLines = lines.slice(i + 1, i + 5).join('\n');
      const isRouter = nextLines.includes(`name = "${ROUTER_ID}"`);

      if (isRouter) {
        skipUntilNextSection = true;
        continue;
      }
    }

    if (trimmed === '[mcp_servers.env]' && skipUntilNextSection) {
      continue;
    }

    if (skipUntilNextSection && trimmed.startsWith('[') && trimmed !== '[mcp_servers.env]') {
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
  return content.includes(`name = "${ROUTER_ID}"`);
}
