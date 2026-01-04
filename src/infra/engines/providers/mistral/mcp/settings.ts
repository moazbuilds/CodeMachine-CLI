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
import {
  getServerPath as getWorkflowSignalsPath,
  getMCPInfraDir,
} from '../../../../mcp/servers/workflow-signals/config.js';
import { getServerPath as getAgentCoordinationPath } from '../../../../mcp/servers/agent-coordination/config.js';

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
 * Generate TOML section for workflow-signals MCP server
 *
 * Vibe uses [[mcp_servers]] array format with: name, transport, command, args
 */
export function generateWorkflowSignalsSection(workflowDir: string): string {
  const serverPath = getWorkflowSignalsPath();
  const mcpDir = getMCPInfraDir();

  const lines = [
    '[[mcp_servers]]',
    'name = "workflow-signals"',
    'transport = "stdio"',
    'command = "bun"',
    `args = ["run", "${serverPath}"]`,
    `cwd = "${mcpDir}"`,
    '',
    '[mcp_servers.env]',
    `WORKFLOW_DIR = "${workflowDir}"`,
  ];

  return lines.join('\n');
}

/**
 * Generate TOML section for agent-coordination MCP server
 */
export function generateAgentCoordinationSection(workingDir: string): string {
  const serverPath = getAgentCoordinationPath();
  const mcpDir = getMCPInfraDir();

  const lines = [
    '[[mcp_servers]]',
    'name = "agent-coordination"',
    'transport = "stdio"',
    'command = "bun"',
    `args = ["run", "${serverPath}"]`,
    `cwd = "${mcpDir}"`,
    '',
    '[mcp_servers.env]',
    `CODEMACHINE_WORKING_DIR = "${workingDir}"`,
  ];

  return lines.join('\n');
}

/**
 * Generate all MCP sections
 */
export function generateAllMCPSections(workflowDir: string): string {
  return [
    generateWorkflowSignalsSection(workflowDir),
    '',
    generateAgentCoordinationSection(workflowDir),
  ].join('\n');
}

/**
 * Remove all codemachine MCP server sections from TOML content
 *
 * Handles [[mcp_servers]] array format used by Vibe.
 * Removes workflow-signals and agent-coordination entries.
 */
export function removeAllMCPSections(content: string): string {
  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  let skipUntilNextSection = false;

  // Patterns for our MCP servers
  const mcpServerPatterns = ['workflow-signals', 'agent-coordination'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this is a [[mcp_servers]] section
    if (trimmed === '[[mcp_servers]]') {
      // Look ahead to check if this is one of our servers
      const nextLines = lines.slice(i + 1, i + 5).join('\n');
      const isOurServer = mcpServerPatterns.some(
        (p) => nextLines.includes(`name = "${p}"`) || nextLines.includes(`name = '${p}'`)
      );

      if (isOurServer) {
        skipUntilNextSection = true;
        continue;
      }
    }

    // Check if this is a [mcp_servers.env] section (belongs to previous [[mcp_servers]])
    if (trimmed === '[mcp_servers.env]' && skipUntilNextSection) {
      continue;
    }

    // If we hit a new section, stop skipping
    if (skipUntilNextSection && trimmed.startsWith('[') && trimmed !== '[mcp_servers.env]') {
      skipUntilNextSection = false;
    }

    // Skip lines while in our MCP server section
    if (skipUntilNextSection) {
      continue;
    }

    cleanedLines.push(line);
  }

  // Clean up multiple consecutive empty lines
  const result: string[] = [];
  let lastWasEmpty = false;
  for (const line of cleanedLines) {
    const isEmpty = line.trim() === '';
    if (isEmpty && lastWasEmpty) {
      continue;
    }
    result.push(line);
    lastWasEmpty = isEmpty;
  }

  return result.join('\n').trim();
}

/**
 * Check if config contains any codemachine MCP server sections
 */
export function hasMCPSections(content: string): boolean {
  return (
    content.includes('name = "workflow-signals"') ||
    content.includes("name = 'workflow-signals'") ||
    content.includes('name = "agent-coordination"') ||
    content.includes("name = 'agent-coordination'")
  );
}
