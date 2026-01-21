/**
 * MCP Router Configuration
 *
 * Path resolution and backend server configuration loading.
 * Follows the same pattern as workflow-signals/config.ts for consistency.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { debug } from '../../../shared/logging/logger.js';
import { MCPPathError } from '../errors.js';
import type { MCPServerConfig } from '../types.js';
import { getServerPath as getWorkflowSignalsPath } from '../servers/workflow-signals/config.js';
import { getServerPath as getAgentCoordinationPath } from '../servers/agent-coordination/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// SERVER METADATA
// ============================================================================

export const ROUTER_ID = 'codemachine';
export const ROUTER_NAME = 'CodeMachine MCP Router';

// ============================================================================
// BACKEND SERVER CONFIG TYPE
// ============================================================================

export interface BackendServerConfig {
  id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Get the path to the MCP router entry point
 *
 * When running from a compiled binary, __dirname resolves to Bun's virtual
 * filesystem (/$bunfs/...) which doesn't exist on disk. In that case, we
 * must use CODEMACHINE_PACKAGE_ROOT to get the real filesystem path.
 */
export function getRouterPath(): string {
  const isCompiledBinary = __dirname.startsWith('/$bunfs');

  debug('[MCP:router] Resolving router path (compiled: %s)', isCompiledBinary);

  if (isCompiledBinary) {
    const packageRoot = process.env.CODEMACHINE_PACKAGE_ROOT;
    if (!packageRoot) {
      throw new MCPPathError(
        'CODEMACHINE_PACKAGE_ROOT must be set when running from compiled binary'
      );
    }
    const routerPath = path.join(packageRoot, 'src', 'infra', 'mcp', 'router', 'index.ts');
    debug('[MCP:router] Using compiled binary path: %s', routerPath);
    return routerPath;
  }

  // Dev mode or bun link - use __dirname which points to real filesystem
  const routerPath = path.resolve(__dirname, 'index.ts');
  debug('[MCP:router] Using dev mode path: %s', routerPath);
  return routerPath;
}

/**
 * Get the MCP config for the router (used by Claude adapter)
 */
export function getRouterConfig(workingDir: string): MCPServerConfig {
  return {
    command: 'bun',
    args: ['run', getRouterPath()],
    env: {
      CODEMACHINE_WORKING_DIR: workingDir,
    },
  };
}

// ============================================================================
// BACKEND SERVER CONFIGURATIONS
// ============================================================================

/**
 * Load built-in backend server configurations
 *
 * These are the MCP servers that ship with codemachine.
 */
function loadBuiltinBackends(workingDir: string): BackendServerConfig[] {
  return [
    {
      id: 'workflow-signals',
      command: 'bun',
      args: ['run', getWorkflowSignalsPath()],
      env: {
        WORKFLOW_DIR: workingDir,
      },
    },
    {
      id: 'agent-coordination',
      command: 'bun',
      args: ['run', getAgentCoordinationPath()],
      env: {
        CODEMACHINE_WORKING_DIR: workingDir,
      },
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
 * Load all backend server configurations
 *
 * Returns combined list of:
 * 1. Built-in servers (workflow-signals, agent-coordination)
 * 2. User config from ~/.config/codemachine/mcp-servers.json
 * 3. Project config from .codemachine/mcp-servers.json
 *
 * Project configs override user configs which override built-in configs for same ID.
 */
export async function loadBackendConfigs(workingDir: string): Promise<Map<string, BackendServerConfig>> {
  const configs = new Map<string, BackendServerConfig>();

  // Load built-in backends first
  const builtins = loadBuiltinBackends(workingDir);
  for (const backend of builtins) {
    configs.set(backend.id, backend);
  }

  // Load user backends (may override built-ins)
  const userBackends = await loadUserBackends(workingDir);
  for (const backend of userBackends) {
    configs.set(backend.id, backend);
  }

  debug('[MCP:router] Loaded %d backend configs', configs.size);
  return configs;
}
