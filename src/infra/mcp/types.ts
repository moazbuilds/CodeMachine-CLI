/**
 * MCP Type Definitions
 *
 * Shared types used across engine MCP adapters.
 */

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/** Configuration scope: project-local or user-global */
export type ConfigScope = 'project' | 'user';

/** Base MCP server configuration (used by Claude, OpenCode) */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** Result of setup/cleanup operations */
export interface MCPSetupResult {
  configured: string[];
  failed: Array<{ adapter: string; error: string }>;
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * MCP Adapter Interface
 *
 * Each engine implements this contract for MCP configuration.
 * Adapters self-register with the central registry when imported.
 */
export interface MCPAdapter {
  /** Unique adapter identifier (matches engine id) */
  readonly id: string;

  /** Human-readable name for logging */
  readonly name: string;

  /** Get settings file path for this engine */
  getSettingsPath(scope: ConfigScope, projectDir?: string): string;

  /** Configure MCP server for this engine */
  configure(workflowDir: string, scope: ConfigScope): Promise<void>;

  /** Remove MCP configuration */
  cleanup(workflowDir: string, scope: ConfigScope): Promise<void>;

  /** Check if MCP is configured */
  isConfigured(workflowDir: string, scope: ConfigScope): Promise<boolean>;
}

// ============================================================================
// MCP FILTERING TYPES
// ============================================================================

/** Server config with optional tool filtering */
export interface MCPServerFilterConfig {
  server: string;
  only?: string[];      // Allowlist - only these tools are available
  exclude?: string[];   // Blocklist - these tools are excluded
}

/** MCP config entry can be a simple server name or a filter config */
export type MCPConfigEntry = string | MCPServerFilterConfig;

/** MCP configuration for agent/step - list of servers with optional filters */
export type MCPConfig = MCPConfigEntry[];

/** Context file written by step execution and read by MCP router */
export interface MCPContextFile {
  version: 1;
  activeServers: MCPServerFilterConfig[];
  uniqueAgentId?: string;
  timestamp: number;
}
