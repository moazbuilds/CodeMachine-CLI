/**
 * MCP Setup Orchestration
 *
 * High-level functions for configuring MCP across multiple engines.
 * Engine adapters self-register when their mcp/index.ts is imported.
 *
 * Usage:
 *   // Configure specific engines
 *   await configureMCP('/path/to/workflow', ['claude', 'codex']);
 *
 *   // Configure all registered engines
 *   await configureMCP('/path/to/workflow');
 */

import { debug } from '../../shared/logging/logger.js';
import { adapterRegistry } from './registry.js';
import type { ConfigScope, MCPSetupResult } from './types.js';

// ============================================================================
// CONFIGURE MCP
// ============================================================================

/**
 * Configure MCP for specified engines
 *
 * @param workflowDir - The workflow directory
 * @param engineIds - Engine IDs to configure (default: all registered)
 * @param scope - Configuration scope (default: 'user')
 */
export async function configureMCP(
  workflowDir: string,
  engineIds?: string[],
  scope: ConfigScope = 'user'
): Promise<MCPSetupResult> {
  const ids = engineIds ?? adapterRegistry.getAllIds();
  const configured: string[] = [];
  const failed: MCPSetupResult['failed'] = [];

  if (ids.length === 0) {
    debug('[MCP:setup] No adapters registered, skipping configuration');
    return { configured, failed };
  }

  debug('[MCP:setup] Configuring engines: %s (scope: %s)', ids.join(', '), scope);

  for (const id of ids) {
    const adapter = adapterRegistry.get(id);

    if (!adapter) {
      debug('[MCP:setup] Unknown adapter: %s', id);
      failed.push({ adapter: id, error: `Unknown adapter: ${id}` });
      continue;
    }

    try {
      await adapter.configure(workflowDir, scope);
      configured.push(id);
      debug('[MCP:setup] Configured %s', id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debug('[MCP:setup] Failed to configure %s: %s', id, message);
      failed.push({ adapter: id, error: message });
    }
  }

  return { configured, failed };
}

// ============================================================================
// CLEANUP MCP
// ============================================================================

/**
 * Cleanup MCP configuration for specified engines
 *
 * @param workflowDir - The workflow directory
 * @param engineIds - Engine IDs to cleanup (default: all registered)
 * @param scope - Configuration scope (default: 'user')
 */
export async function cleanupMCP(
  workflowDir: string,
  engineIds?: string[],
  scope: ConfigScope = 'user'
): Promise<MCPSetupResult> {
  const ids = engineIds ?? adapterRegistry.getAllIds();
  const configured: string[] = [];
  const failed: MCPSetupResult['failed'] = [];

  debug('[MCP:setup] Cleaning up engines: %s (scope: %s)', ids.join(', '), scope);

  for (const id of ids) {
    const adapter = adapterRegistry.get(id);

    if (!adapter) {
      // Skip unknown adapters during cleanup
      continue;
    }

    try {
      await adapter.cleanup(workflowDir, scope);
      configured.push(id);
      debug('[MCP:setup] Cleaned up %s', id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debug('[MCP:setup] Failed to cleanup %s: %s', id, message);
      failed.push({ adapter: id, error: message });
    }
  }

  return { configured, failed };
}

// ============================================================================
// CHECK CONFIGURATION
// ============================================================================

/**
 * Check if MCP is configured for specified engines
 *
 * @param workflowDir - The workflow directory
 * @param engineIds - Engine IDs to check (default: all registered)
 * @param scope - Configuration scope (default: 'user')
 * @returns true if ALL specified engines are configured
 */
export async function isMCPConfigured(
  workflowDir: string,
  engineIds?: string[],
  scope: ConfigScope = 'user'
): Promise<boolean> {
  const ids = engineIds ?? adapterRegistry.getAllIds();

  if (ids.length === 0) {
    return true; // No adapters to check
  }

  for (const id of ids) {
    const adapter = adapterRegistry.get(id);

    if (!adapter) {
      return false; // Unknown adapter = not configured
    }

    const configured = await adapter.isConfigured(workflowDir, scope);
    if (!configured) {
      return false;
    }
  }

  return true;
}
