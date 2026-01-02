/**
 * MCP Error Classes
 *
 * Custom errors for MCP configuration and path resolution.
 */

// ============================================================================
// CONFIG ERRORS
// ============================================================================

/**
 * Error during MCP configuration (configure/cleanup/check)
 */
export class MCPConfigError extends Error {
  constructor(
    message: string,
    public readonly adapter: string,
    public readonly cause?: Error
  ) {
    super(`[${adapter}] ${message}`);
    this.name = 'MCPConfigError';
  }
}

// ============================================================================
// PATH ERRORS
// ============================================================================

/**
 * Error resolving MCP server paths
 */
export class MCPPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPPathError';
  }
}
