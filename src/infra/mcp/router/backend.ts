/**
 * MCP Backend Connection Manager
 *
 * Manages connections to backend MCP servers via stdio transport.
 * Each backend is spawned as a child process and communicates via MCP protocol.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { debug } from '../../../shared/logging/logger.js';
import type { BackendServerConfig } from './config.js';
import type { MCPServerFilterConfig } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface MCPBackendStatus {
  connected: boolean;
  toolCount: number;
  error?: string;
}

// ============================================================================
// MCP BACKEND CLASS
// ============================================================================

/**
 * MCPBackend manages a single backend MCP server connection
 *
 * Lifecycle:
 * 1. connect() - Spawns server process, establishes MCP connection, fetches tools
 * 2. getTools() - Returns cached tool list
 * 3. callTool() - Forwards tool calls to backend
 * 4. disconnect() - Gracefully shuts down connection and process
 */
export class MCPBackend {
  private readonly id: string;
  private readonly config: BackendServerConfig;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];
  private connected = false;

  constructor(id: string, config: BackendServerConfig) {
    this.id = id;
    this.config = config;
  }

  /**
   * Get backend identifier
   */
  getId(): string {
    return this.id;
  }

  /**
   * Connect to the backend MCP server
   *
   * Spawns the server process and establishes MCP protocol connection.
   * Fetches and caches the tool list on successful connection.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      debug('[MCP:backend:%s] Already connected', this.id);
      return;
    }

    debug('[MCP:backend:%s] Connecting to %s %s', this.id, this.config.command, this.config.args.join(' '));

    try {
      // Build environment with inherited env plus config-specific env
      // Filter out undefined values to satisfy Record<string, string> type
      const baseEnv: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          baseEnv[key] = value;
        }
      }
      const env = {
        ...baseEnv,
        ...this.config.env,
      };

      // Create transport that spawns the server process
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env,
      });

      // Create MCP client
      this.client = new Client(
        {
          name: `router-client-${this.id}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect client to transport
      await this.client.connect(this.transport);

      // Fetch and cache tools
      const toolsResult = await this.client.listTools();
      this.tools = toolsResult.tools as Tool[];

      this.connected = true;
      debug('[MCP:backend:%s] Connected, found %d tools', this.id, this.tools.length);
    } catch (error) {
      debug('[MCP:backend:%s] Connection failed: %s', this.id, (error as Error).message);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Disconnect from the backend MCP server
   *
   * Gracefully closes the MCP connection and terminates the server process.
   */
  async disconnect(): Promise<void> {
    debug('[MCP:backend:%s] Disconnecting', this.id);
    await this.cleanup();
  }

  /**
   * Internal cleanup helper
   */
  private async cleanup(): Promise<void> {
    this.connected = false;
    this.tools = [];

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        debug('[MCP:backend:%s] Error closing client: %s', this.id, (error as Error).message);
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        debug('[MCP:backend:%s] Error closing transport: %s', this.id, (error as Error).message);
      }
      this.transport = null;
    }
  }

  /**
   * Get the list of tools provided by this backend
   */
  getTools(): Tool[] {
    return this.tools;
  }

  /**
   * Check if backend is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get backend status
   */
  getStatus(): MCPBackendStatus {
    return {
      connected: this.connected,
      toolCount: this.tools.length,
    };
  }

  /**
   * Call a tool on this backend
   *
   * Forwards the tool call via MCP protocol to the backend server.
   * The caller must ensure the tool belongs to this backend.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    if (!this.connected || !this.client) {
      throw new Error(`Backend ${this.id} is not connected`);
    }

    debug('[MCP:backend:%s] Calling tool: %s', this.id, name);

    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });

      return result as CallToolResult;
    } catch (error) {
      debug('[MCP:backend:%s] Tool call failed: %s', this.id, (error as Error).message);
      throw error;
    }
  }
}

// ============================================================================
// BACKEND MANAGER
// ============================================================================

/**
 * BackendManager manages multiple MCPBackend connections
 *
 * Provides:
 * - Connection lifecycle for all backends
 * - Tool aggregation and routing
 * - Backend lookup by tool name
 */
export class BackendManager {
  private backends: Map<string, MCPBackend> = new Map();
  private toolRouting: Map<string, string> = new Map(); // tool name → backend id

  /**
   * Add a backend configuration
   */
  addBackend(id: string, config: BackendServerConfig): void {
    const backend = new MCPBackend(id, config);
    this.backends.set(id, backend);
    debug('[MCP:manager] Added backend: %s', id);
  }

  /**
   * Connect to all configured backends
   *
   * Connections are attempted in parallel. Failed connections are logged
   * but don't prevent other backends from connecting.
   */
  async connectAll(): Promise<void> {
    debug('[MCP:manager] Connecting to %d backends', this.backends.size);

    await Promise.allSettled(
      Array.from(this.backends.values()).map((backend) => backend.connect())
    );

    // Build tool routing table from successfully connected backends
    this.toolRouting.clear();

    for (const [id, backend] of this.backends) {
      if (backend.isConnected()) {
        for (const tool of backend.getTools()) {
          if (this.toolRouting.has(tool.name)) {
            debug('[MCP:manager] Warning: tool %s already registered by %s, overriding with %s',
              tool.name, this.toolRouting.get(tool.name), id);
          }
          this.toolRouting.set(tool.name, id);
        }
      }
    }

    // Log connection results
    const connected = Array.from(this.backends.values()).filter((b) => b.isConnected()).length;
    debug('[MCP:manager] Connected to %d/%d backends, %d tools available',
      connected, this.backends.size, this.toolRouting.size);
  }

  /**
   * Disconnect all backends
   */
  async disconnectAll(): Promise<void> {
    debug('[MCP:manager] Disconnecting all backends');

    await Promise.allSettled(
      Array.from(this.backends.values()).map((backend) => backend.disconnect())
    );

    this.toolRouting.clear();
  }

  /**
   * Get aggregated list of all tools from all connected backends
   */
  getAllTools(): Tool[] {
    const tools: Tool[] = [];
    for (const backend of this.backends.values()) {
      if (backend.isConnected()) {
        tools.push(...backend.getTools());
      }
    }
    return tools;
  }

  /**
   * Get the backend ID for a given tool name
   */
  getBackendForTool(toolName: string): string | undefined {
    return this.toolRouting.get(toolName);
  }

  /**
   * Call a tool, routing to the appropriate backend
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const backendId = this.toolRouting.get(name);
    if (!backendId) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const backend = this.backends.get(backendId);
    if (!backend || !backend.isConnected()) {
      throw new Error(`Backend ${backendId} for tool ${name} is not available`);
    }

    return backend.callTool(name, args);
  }

  /**
   * Get status of all backends
   */
  getStatus(): Record<string, MCPBackendStatus> {
    const status: Record<string, MCPBackendStatus> = {};
    for (const [id, backend] of this.backends) {
      status[id] = backend.getStatus();
    }
    return status;
  }

  // ==========================================================================
  // TOOL FILTERING
  // ==========================================================================

  /**
   * Get tools filtered by active server configuration
   *
   * If activeServers is empty, returns NO tools (agent must explicitly opt-in).
   * Otherwise, only returns tools from specified servers with only/exclude applied.
   *
   * @param activeServers - Server filter configurations (empty = no access)
   * @returns Filtered list of tools
   */
  getFilteredTools(activeServers: MCPServerFilterConfig[]): Tool[] {
    // Empty config means no MCP access - return no tools
    if (activeServers.length === 0) {
      return [];
    }

    const filteredTools: Tool[] = [];
    const allowedServerIds = new Set(activeServers.map((s) => s.server));

    for (const [backendId, backend] of this.backends) {
      // Skip disconnected backends or backends not in allowed list
      if (!backend.isConnected() || !allowedServerIds.has(backendId)) {
        continue;
      }

      // Get the filter config for this server
      const serverConfig = activeServers.find((s) => s.server === backendId);
      if (!serverConfig) continue;

      // Apply tool-level filtering
      filteredTools.push(...this.filterToolsForServer(backend.getTools(), serverConfig));
    }

    return filteredTools;
  }

  /**
   * Filter tools for a single server based on only/exclude config
   *
   * @param tools - Tools from the server
   * @param config - Server filter configuration
   * @returns Filtered tools
   */
  private filterToolsForServer(tools: Tool[], config: MCPServerFilterConfig): Tool[] {
    // Only filter takes precedence - return only matching tools
    if (config.only && config.only.length > 0) {
      return tools.filter((t) => config.only!.includes(t.name));
    }

    // Exclude filter - return tools not in exclude list
    if (config.exclude && config.exclude.length > 0) {
      return tools.filter((t) => !config.exclude!.includes(t.name));
    }

    // No filter - return all tools
    return tools;
  }

  /**
   * Check if a specific tool is allowed by the current filter configuration
   *
   * @param toolName - Name of the tool to check
   * @param activeServers - Server filter configurations (empty = no access)
   * @returns True if tool is allowed, false otherwise
   */
  isToolAllowed(toolName: string, activeServers: MCPServerFilterConfig[]): boolean {
    // Empty config means no MCP access - no tools allowed
    if (activeServers.length === 0) {
      return false;
    }

    // Find which backend owns this tool
    const backendId = this.toolRouting.get(toolName);
    if (!backendId) {
      return false; // Unknown tool
    }

    // Check if backend is in allowed list
    const config = activeServers.find((s) => s.server === backendId);
    if (!config) {
      return false; // Backend not in allowed list
    }

    // Check tool-level filters
    if (config.only && config.only.length > 0) {
      return config.only.includes(toolName);
    }

    if (config.exclude && config.exclude.length > 0) {
      return !config.exclude.includes(toolName);
    }

    // No tool-level filter - tool is allowed
    return true;
  }
}
