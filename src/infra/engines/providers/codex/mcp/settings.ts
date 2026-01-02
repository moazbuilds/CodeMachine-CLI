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
import { getServerPath, getMCPInfraDir } from '../../../../mcp/servers/workflow-signals/config.js';

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
 * Generate TOML section for workflow-signals MCP server
 *
 * Codex uses TOML format with: command, args, cwd, startup_timeout_sec, env
 */
export function generateMCPSection(workflowDir: string): string {
  const serverPath = getServerPath();
  const mcpDir = getMCPInfraDir();

  const lines = [
    '[mcp_servers."workflow-signals"]',
    'command = "bun"',
    `args = ["run", "${serverPath}"]`,
    `cwd = "${mcpDir}"`,
    'startup_timeout_sec = 40',
    '',
    '[mcp_servers."workflow-signals".env]',
    `WORKFLOW_DIR = "${workflowDir}"`,
  ];

  return lines.join('\n');
}

/**
 * Remove workflow-signals sections from TOML content
 *
 * Cleans all workflow-signals related lines including malformed entries.
 */
export function removeWorkflowSignalsSections(content: string): string {
  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  let skipUntilNextSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a workflow-signals section (any variant)
    if (trimmed.startsWith('[') && trimmed.includes('workflow-signals')) {
      skipUntilNextSection = true;
      continue;
    }

    // Check if this is a malformed line starting with ["run" (broken args)
    if (trimmed.startsWith('["run"')) {
      skipUntilNextSection = true;
      continue;
    }

    // If we hit a new section that's NOT workflow-signals, stop skipping
    if (
      skipUntilNextSection &&
      trimmed.startsWith('[') &&
      !trimmed.includes('workflow-signals')
    ) {
      skipUntilNextSection = false;
    }

    // Skip lines while in workflow-signals section
    if (skipUntilNextSection) {
      continue;
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join('\n').trim();
}

/**
 * Check if config contains workflow-signals section
 */
export function hasWorkflowSignalsSection(content: string): boolean {
  return (
    content.includes('[mcp_servers."workflow-signals"]') ||
    content.includes('[mcp_servers.workflow-signals]')
  );
}
