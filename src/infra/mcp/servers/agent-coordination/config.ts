/**
 * Agent Coordination MCP Server Configuration
 *
 * Generic server metadata and path resolution for the agent-coordination server.
 * Engine-specific config builders live in each provider's mcp/ folder.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { debug } from '../../../../shared/logging/logger.js';
import { MCPPathError } from '../../errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// SERVER METADATA
// ============================================================================

export const SERVER_ID = 'agent-coordination';
export const SERVER_NAME = 'Agent Coordination';

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Get the path to the agent-coordination MCP server entry point
 *
 * When running from a compiled binary, __dirname resolves to Bun's virtual
 * filesystem (/$bunfs/...) which doesn't exist on disk. In that case, we
 * must use CODEMACHINE_PACKAGE_ROOT to get the real filesystem path.
 */
export function getServerPath(): string {
  const isCompiledBinary = __dirname.startsWith('/$bunfs');

  debug('[MCP:agent-coordination] Resolving server path (compiled: %s)', isCompiledBinary);

  if (isCompiledBinary) {
    const packageRoot = process.env.CODEMACHINE_PACKAGE_ROOT;
    if (!packageRoot) {
      throw new MCPPathError(
        'CODEMACHINE_PACKAGE_ROOT must be set when running from compiled binary'
      );
    }
    const serverPath = path.join(
      packageRoot,
      'src',
      'infra',
      'mcp',
      'servers',
      'agent-coordination',
      'index.ts'
    );
    debug('[MCP:agent-coordination] Using compiled binary path: %s', serverPath);
    return serverPath;
  }

  // Dev mode or bun link - use __dirname which points to real filesystem
  const serverPath = path.resolve(__dirname, 'index.ts');
  debug('[MCP:agent-coordination] Using dev mode path: %s', serverPath);
  return serverPath;
}

/**
 * Get the directory containing the MCP server (useful for cwd)
 */
export function getServerDir(): string {
  return path.dirname(getServerPath());
}

/**
 * Get the MCP infra directory (parent of servers/)
 */
export function getMCPInfraDir(): string {
  return path.dirname(path.dirname(getServerPath()));
}
