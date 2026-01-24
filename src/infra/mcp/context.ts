/**
 * MCP Context Management
 *
 * Manages the context file that communicates MCP filtering configuration
 * from step execution to the MCP router process.
 *
 * Flow:
 *   1. Step execution merges agent + step MCP configs
 *   2. Context is written to ./.codemachine/mcp/context.json (project-level)
 *   3. MCP router reads context to filter available tools
 *
 * Uses project-level location so multiple projects can run simultaneously.
 */

import * as path from 'node:path';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { debug } from '../../shared/logging/logger.js';
import type { MCPConfig, MCPServerFilterConfig, MCPContextFile } from './types.js';

/**
 * Get the project-level MCP context file path.
 * Uses .codemachine/mcp/context.json relative to cwd so multiple
 * projects can run simultaneously without conflicts.
 */
function getContextPath(cwd?: string): string {
  const projectDir = cwd || process.cwd();
  return path.join(projectDir, '.codemachine', 'mcp', 'context.json');
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
 * @param workingDir - Project working directory
 * @param activeServers - List of active servers with filter configs
 * @param uniqueAgentId - Optional agent identifier for debugging
 */
export async function writeMCPContext(
  workingDir: string,
  activeServers: MCPServerFilterConfig[],
  uniqueAgentId?: string,
): Promise<void> {
  const contextPath = getContextPath(workingDir);
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

  debug('[MCP:context] Wrote context: %d servers, agent=%s, path=%s', activeServers.length, uniqueAgentId ?? 'N/A', contextPath);
}

/**
 * Read MCP context file
 *
 * Called by MCP router to determine current filtering configuration.
 * Returns null if no context file exists (means no filtering).
 *
 * @param cwd - Project working directory (defaults to process.cwd())
 * @returns Context file contents or null
 */
export async function readMCPContext(cwd?: string): Promise<MCPContextFile | null> {
  const contextPath = getContextPath(cwd);

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
 * @param cwd - Project working directory (defaults to process.cwd())
 */
export async function clearMCPContext(cwd?: string): Promise<void> {
  const contextPath = getContextPath(cwd);

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
