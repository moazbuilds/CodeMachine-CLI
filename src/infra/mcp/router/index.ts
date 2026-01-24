#!/usr/bin/env node
/**
 * MCP Router
 *
 * A Model Context Protocol (MCP) server that acts as a middle layer,
 * aggregating tools from multiple backend servers.
 *
 * Benefits:
 * - Single MCP entry in .claude.json (simpler configuration)
 * - Runtime control over which backend servers are active
 * - Tool aggregation from multiple backends with transparent routing
 * - Built-in servers run in-process (no external dependencies)
 * - Support for user-defined servers via config files
 *
 * Usage:
 *   codemachine mcp router
 *
 * The router runs as part of the codemachine binary, eliminating the need
 * for bun or path resolution for built-in MCP servers.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { BackendManager } from './backend.js';
import { loadBackendConfigs, ROUTER_ID } from './config.js';
import { readMCPContext } from '../context.js';

// ============================================================================
// ROUTER CLASS
// ============================================================================

class MCPRouter {
  private backendManager: BackendManager;
  private server: Server;
  private workingDir: string;

  constructor(workingDir: string) {
    this.workingDir = workingDir;
    this.backendManager = new BackendManager();
    this.server = new Server(
      {
        name: ROUTER_ID,
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Initialize the router by loading configs and connecting to backends
   */
  async initialize(): Promise<void> {
    // Load backend configurations
    const { inProcess, external } = await loadBackendConfigs(this.workingDir);

    // Add in-process backends (built-in servers)
    for (const config of inProcess) {
      this.backendManager.addInProcessBackend(config);
    }

    // Add external backends (user-defined servers)
    for (const [id, config] of external) {
      this.backendManager.addBackend(id, config);
    }

    // Connect to all backends (in-process are always connected)
    await this.backendManager.connectAll();
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle tools/list - aggregate tools from all backends with filtering
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Read context to determine active servers and filtering
      const context = await readMCPContext(this.workingDir);
      const activeServers = context?.activeServers ?? [];

      return {
        tools: this.backendManager.getFilteredTools(activeServers),
      };
    });

    // Handle tools/call - route to appropriate backend with access control
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Read context to check tool access
      const context = await readMCPContext(this.workingDir);
      const activeServers = context?.activeServers ?? [];

      // Check if tool is allowed by current configuration
      if (!this.backendManager.isToolAllowed(name, activeServers)) {
        return {
          content: [
            {
              type: 'text',
              text: `Tool "${name}" is not available for current agent/step.`,
            },
          ],
          isError: true,
        };
      }

      // Get targets filter for this tool's backend and inject into args
      const backendId = this.backendManager.getBackendForTool(name);
      const serverConfig = activeServers.find((s) => s.server === backendId);
      const allowedTargets = serverConfig?.targets ?? null;

      // Inject _allowed_targets into args for MCP server to use
      const enrichedArgs: Record<string, unknown> = {
        ...(args || {}),
        _allowed_targets: allowedTargets,
      };

      try {
        const result = await this.backendManager.callTool(name, enrichedArgs);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Router Error: ${message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Start the MCP server on stdio
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Shutdown the router
   */
  async shutdown(): Promise<void> {
    await this.backendManager.disconnectAll();
  }
}

// ============================================================================
// EXPORTED ENTRY POINT
// ============================================================================

/**
 * Start the MCP router server
 *
 * Exported for CLI to call via `codemachine mcp router`.
 * Uses process.cwd() as the working directory.
 */
export async function startRouter(): Promise<void> {
  const workingDir = process.cwd();
  const router = new MCPRouter(workingDir);

  // Handle graceful shutdown
  const shutdown = async () => {
    await router.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Initialize and start
  await router.initialize();
  await router.start();
}

// ============================================================================
// MAIN (for direct execution with bun)
// ============================================================================

// Only auto-run if executed directly (not imported)
if (import.meta.main) {
  startRouter().catch((error) => {
    console.error('[mcp-router] Fatal error:', error);
    process.exit(1);
  });
}
