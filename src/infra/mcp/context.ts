/**
 * MCP Context Management
 *
 * Manages the context file that communicates MCP filtering configuration
 * from step execution to the MCP router process.
 *
 * Flow:
 *   1. Step execution merges agent + step MCP configs
 *   2. Context is written to ~/.codemachine/mcp/context.json (global)
 *   3. MCP router reads context to filter available tools
 *
 * Uses a global location (CODEMACHINE_HOME) so the router always finds
 * the context regardless of which project directory is active.
 */

import * as path from 'node:path';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { debug } from '../../shared/logging/logger.js';
import { getCodemachineHomeDir } from '../../shared/imports/index.js';
import type { MCPConfig, MCPServerFilterConfig, MCPContextFile } from './types.js';

/**
 * Get the global MCP context file path.
 * Uses CODEMACHINE_HOME (~/.codemachine by default) so the router
 * always finds the context regardless of working directory.
 */
function getContextPath(): string {
  return path.join(getCodemachineHomeDir(), 'mcp', 'context.json');
}

/**
 * Normalize MCP config entries to MCPServerFilterConfig format
 *
 * Converts string entries to { server: string } objects for consistent handling.
 *
 * @param config - MCP config array (strings or objects)
 * @returns Normalized array of MCPServerFilterConfig
 */
export function resolveMCPConfig(config: MCPConfig | undefined): MCPServerFilterConfig[] {
  if (!config || config.length === 0) {
    return [];
  }

  return config.map((entry) => {
    if (typeof entry === 'string') {
      return { server: entry };
    }
    return entry;
  });
}

/**
 * Merge agent and step MCP configurations
 *
 * Step config overrides agent config on a per-server basis:
 * - If step specifies a server, use step's config for that server
 * - If agent specifies a server not in step, include it unchanged
 * - Empty step config means "use agent config"
 * - Empty agent config with step config means "use step config only"
 *
 * @param agentConfig - Agent-level MCP config
 * @param stepConfig - Step-level MCP config (overrides agent)
 * @returns Merged config
 */
export function mergeMCPConfigs(
  agentConfig: MCPConfig | undefined,
  stepConfig: MCPConfig | undefined,
): MCPServerFilterConfig[] {
  const resolvedAgent = resolveMCPConfig(agentConfig);
  const resolvedStep = resolveMCPConfig(stepConfig);

  // If step has no config, use agent config as-is
  if (resolvedStep.length === 0) {
    return resolvedAgent;
  }

  // Step config completely replaces agent config for servers it specifies
  // Build a map of step servers for quick lookup
  const stepServers = new Set(resolvedStep.map((s) => s.server));

  // Start with step config
  const merged: MCPServerFilterConfig[] = [...resolvedStep];

  // Add agent servers that aren't overridden by step
  for (const agentServer of resolvedAgent) {
    if (!stepServers.has(agentServer.server)) {
      merged.push(agentServer);
    }
  }

  return merged;
}

/**
 * Write MCP context file
 *
 * Called by step execution before invoking the agent.
 * The MCP router reads this file to determine tool filtering.
 *
 * @param workingDir - Project working directory (stored for agent resolution)
 * @param activeServers - List of active servers with filter configs
 * @param uniqueAgentId - Optional agent identifier for debugging
 */
export async function writeMCPContext(
  workingDir: string,
  activeServers: MCPServerFilterConfig[],
  uniqueAgentId?: string,
): Promise<void> {
  const contextPath = getContextPath();
  const contextDir = path.dirname(contextPath);

  // Ensure directory exists
  await mkdir(contextDir, { recursive: true });

  const contextFile: MCPContextFile = {
    version: 1,
    activeServers,
    uniqueAgentId,
    timestamp: Date.now(),
  };

  const content = JSON.stringify(contextFile, null, 2);
  await writeFile(contextPath, content, 'utf8');

  debug('[MCP:context] Wrote context: %d servers, agent=%s, workingDir=%s', activeServers.length, uniqueAgentId ?? 'N/A', workingDir);
}

/**
 * Read MCP context file
 *
 * Called by MCP router to determine current filtering configuration.
 * Returns null if no context file exists (means no filtering).
 *
 * @param _cwd - Unused (kept for API compatibility)
 * @returns Context file contents or null
 */
export async function readMCPContext(_cwd?: string): Promise<MCPContextFile | null> {
  const contextPath = getContextPath();

  try {
    const content = await readFile(contextPath, 'utf8');
    const parsed = JSON.parse(content) as MCPContextFile;

    // Validate version
    if (parsed.version !== 1) {
      debug('[MCP:context] Unknown context version: %s', parsed.version);
      return null;
    }

    return parsed;
  } catch (error) {
    // File doesn't exist or is invalid - that's ok, means no filtering
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      debug('[MCP:context] Error reading context: %s', (error as Error).message);
    }
    return null;
  }
}

/**
 * Clear MCP context file
 *
 * Removes the context file, effectively disabling filtering.
 * Called when step has no MCP config (all tools available).
 *
 * @param _cwd - Unused (kept for API compatibility)
 */
export async function clearMCPContext(_cwd?: string): Promise<void> {
  const contextPath = getContextPath();

  try {
    await unlink(contextPath);
    debug('[MCP:context] Cleared context file');
  } catch (error) {
    // File doesn't exist - that's fine
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      debug('[MCP:context] Error clearing context: %s', (error as Error).message);
    }
  }
}
