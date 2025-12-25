/**
 * Codex Engine MCP Configuration
 *
 * Provides MCP server configuration for workflow signals integration.
 * This enables Codex agents to use structured tool calls for workflow orchestration.
 * Codex uses config.toml format.
 */

import * as fs from 'fs/promises';
import type { EngineMCPConfig } from '../../core/base.js';
import {
  configureCodexMCP,
  getCodexSettingsPath,
} from '../../../mcp/index.js';

/**
 * Configure MCP servers for Codex
 */
async function configure(_workflowDir: string): Promise<void> {
  await configureCodexMCP(_workflowDir, 'user');
}

/**
 * Remove MCP server configuration from config.toml
 */
async function cleanup(_workflowDir: string): Promise<void> {
  const configPath = getCodexSettingsPath('user');

  try {
    const content = await fs.readFile(configPath, 'utf-8');

    // Line-by-line cleanup approach
    const lines = content.split('\n');
    const cleanedLines: string[] = [];
    let skipUntilNextSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('[') && trimmed.includes('workflow-signals')) {
        skipUntilNextSection = true;
        continue;
      }

      if (trimmed.startsWith('["run"')) {
        skipUntilNextSection = true;
        continue;
      }

      if (skipUntilNextSection && trimmed.startsWith('[') && !trimmed.includes('workflow-signals')) {
        skipUntilNextSection = false;
      }

      if (skipUntilNextSection) {
        continue;
      }

      cleanedLines.push(line);
    }

    await fs.writeFile(configPath, cleanedLines.join('\n').trim() + '\n');
  } catch {
    // File doesn't exist or other error - nothing to clean up
  }
}

/**
 * Check if MCP is configured for Codex
 */
async function isConfigured(_workflowDir: string): Promise<boolean> {
  const configPath = getCodexSettingsPath('user');

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return content.includes('[mcp_servers."workflow-signals"]') || content.includes('[mcp_servers.workflow-signals]');
  } catch {
    return false;
  }
}

/**
 * MCP configuration for Codex engine
 */
export const mcp: EngineMCPConfig = {
  supported: true,
  configure,
  cleanup,
  isConfigured,
};
