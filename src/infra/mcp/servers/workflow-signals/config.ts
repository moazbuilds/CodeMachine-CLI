/**
 * Workflow Signals MCP Server Configuration
 *
 * Generic server metadata and path resolution for the workflow-signals server.
 * Engine-specific config builders live in each provider's mcp/ folder.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { debug } from '../../../../shared/logging/logger.js';
import { getDevRoot } from '../../../../shared/runtime/dev.js';
import { MCPPathError } from '../../errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// SERVER METADATA
// ============================================================================

export const SERVER_ID = 'workflow-signals';
export const SERVER_NAME = 'Workflow Signals';

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Get the path to the workflow-signals MCP server entry point
 *
 * When running from a compiled binary, __dirname resolves to Bun's virtual
 * filesystem (/$bunfs/...) which doesn't exist on disk. In that case, we
 * fall back to getDevRoot().
 */
export function getServerPath(): string {
  const isCompiledBinary = __dirname.startsWith('/$bunfs');

  debug('[MCP:workflow-signals] Resolving server path (compiled: %s)', isCompiledBinary);

  if (isCompiledBinary) {
    const devRoot = getDevRoot();
    if (!devRoot) {
      throw new MCPPathError(
        'Cannot resolve MCP server path from compiled binary without dev root'
      );
    }
    const serverPath = path.join(
      devRoot,
      'src',
      'infra',
      'mcp',
      'servers',
      'workflow-signals',
      'index.ts'
    );
    debug('[MCP:workflow-signals] Using dev root path: %s', serverPath);
    return serverPath;
  }

  // Dev mode or bun link - use __dirname which points to real filesystem
  const serverPath = path.resolve(__dirname, 'index.ts');
  debug('[MCP:workflow-signals] Using dev mode path: %s', serverPath);
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
