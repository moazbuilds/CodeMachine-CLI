/**
 * MCP Router Configuration
 *
 * Configuration for the MCP router and backend servers.
 * The router now runs as part of the codemachine binary.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { homedir } from 'os';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { debug } from '../../../shared/logging/logger.js';
import type { MCPServerConfig } from '../types.js';
import { workflowSignalTools } from '../servers/workflow-signals/tools.js';
import { handleWorkflowSignalsTool } from '../servers/workflow-signals/handler.js';
import { agentCoordinationTools } from '../servers/agent-coordination/tools.js';
import { handleAgentCoordinationTool } from '../servers/agent-coordination/handler.js';

// ============================================================================
// SERVER METADATA
// ============================================================================

export const ROUTER_ID = 'codemachine';
export const ROUTER_NAME = 'CodeMachine MCP Router';

// ============================================================================
// BACKEND SERVER CONFIG TYPES
// ============================================================================

/**
 * Configuration for external MCP backend servers (spawned as child processes)
 */
export interface BackendServerConfig {
  id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Tool handler function type for in-process backends
 */
export type ToolHandler = (
  name: string,
  args: Record<string, unknown>
) => Promise<CallToolResult>;

/**
 * Configuration for in-process backend servers (no child process)
 */
export interface InProcessBackendConfig {
  id: string;
  tools: Tool[];
  handler: ToolHandler;
}

// ============================================================================
// ROUTER CONFIG
// ============================================================================

/**
 * Get the MCP config for the router (used by engine adapters)
 *
 * The router now runs as `codemachine mcp router` instead of spawning
 * a separate bun process. This eliminates path resolution issues and
 * external dependencies.
 */
export function getRouterConfig(): MCPServerConfig {
  const config: MCPServerConfig = {
    command: 'codemachine',
    args: ['mcp', 'router'],
  };

  // Only add LOG_LEVEL if debugging is enabled
  if (process.env.LOG_LEVEL === 'debug') {
    config.env = { LOG_LEVEL: 'debug' };
  }

  return config;
}

// ============================================================================
// BACKEND SERVER CONFIGURATIONS
// ============================================================================

/**
 * Load built-in backend server configurations
 *
 * These are the MCP servers that ship with codemachine.
 * They run in-process (no child processes needed).
 */
export function loadBuiltinBackends(): InProcessBackendConfig[] {
  return [
    {
      id: 'workflow-signals',
      tools: workflowSignalTools,
      handler: handleWorkflowSignalsTool,
    },
    {
      id: 'agent-coordination',
      tools: agentCoordinationTools,
      handler: handleAgentCoordinationTool,
    },
  ];
}

/**
 * Load user-defined MCP servers from config file
 *
 * Looks for servers in:
 * - ~/.config/codemachine/mcp-servers.json (user global)
 * - .codemachine/mcp-servers.json (project local)
 *
 * Format:
 * {
 *   "servers": {
 *     "my-server": {
 *       "command": "node",
 *       "args": ["path/to/server.js"],
 *       "env": { "KEY": "value" }
 *     }
 *   }
 * }
 */
async function loadUserBackends(workingDir: string): Promise<BackendServerConfig[]> {
  const backends: BackendServerConfig[] = [];

  // User global config
  const userConfigPath = path.join(homedir(), '.config', 'codemachine', 'mcp-servers.json');

  // Project local config
  const projectConfigPath = path.join(workingDir, '.codemachine', 'mcp-servers.json');

  for (const configPath of [userConfigPath, projectConfigPath]) {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as {
        servers?: Record<string, Omit<BackendServerConfig, 'id'>>;
      };

      if (config.servers) {
        for (const [id, serverConfig] of Object.entries(config.servers)) {
          backends.push({
            id,
            command: serverConfig.command,
            args: serverConfig.args || [],
            env: serverConfig.env,
          });
          debug('[MCP:router] Loaded user backend from %s: %s', configPath, id);
        }
      }
    } catch (error) {
      // Config file doesn't exist or is invalid - that's fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        debug('[MCP:router] Error loading config from %s: %s', configPath, (error as Error).message);
      }
    }
  }

  return backends;
}

/**
 * Result of loading backend configurations
 */
export interface LoadedBackendConfigs {
  /** In-process backends (built-in servers) */
  inProcess: InProcessBackendConfig[];
  /** External backends (user-defined servers spawned as child processes) */
  external: Map<string, BackendServerConfig>;
}

/**
 * Load all backend server configurations
 *
 * Returns:
 * 1. Built-in servers as in-process configs (workflow-signals, agent-coordination)
 * 2. User-defined servers as external configs from config files
 *
 * Built-in servers run in-process for better performance.
 * User-defined servers are spawned as child processes.
 */
export async function loadBackendConfigs(workingDir: string): Promise<LoadedBackendConfigs> {
  // Load built-in backends (run in-process)
  const inProcess = loadBuiltinBackends();

  // Load user backends (run as child processes)
  const userBackends = await loadUserBackends(workingDir);
  const external = new Map<string, BackendServerConfig>();
  for (const backend of userBackends) {
    external.set(backend.id, backend);
  }

  debug('[MCP:router] Loaded %d in-process backends, %d external backends',
    inProcess.length, external.size);

  return { inProcess, external };
}
