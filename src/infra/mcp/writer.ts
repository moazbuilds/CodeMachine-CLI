/**
 * Lightweight MCP Config Writer
 *
 * Ensures MCP server configuration exists before agent execution.
 * Uses lazy initialization - checks first, writes only if missing.
 *
 * Design:
 *   - Triggered before agent execution
 *   - Fast path: skip if already configured
 *   - Dynamic imports to avoid loading at module time
 */

import { debug } from '../../shared/logging/logger.js';

export interface MCPWriteResult {
  success: boolean;
  engine: string;
  skipped?: boolean;
  error?: string;
}

/**
 * Ensure MCP config exists for an engine
 *
 * Fast check-first pattern:
 *   - If configured: return immediately (no delay)
 *   - If not: write config (one-time cost)
 *
 * @param engineId - Engine identifier (e.g., 'codex', 'claude')
 * @param workingDir - Working directory for MCP env vars
 */
export async function ensureMCPConfig(
  engineId: string,
  workingDir: string
): Promise<MCPWriteResult> {
  try {
    // Dynamic import - only load registry when needed
    const { adapterRegistry } = await import('./registry.js');

    // Dynamic import of engine's MCP adapter (registers itself)
    try {
      await import(`../engines/providers/${engineId}/mcp/index.js`);
    } catch (importError) {
      // Log actual error to help diagnose issues
      debug('[MCP:writer] Failed to import MCP adapter for engine %s: %s', engineId, (importError as Error).message);
      debug('[MCP:writer] Import error stack: %s', (importError as Error).stack);
      return { success: true, engine: engineId, skipped: true };
    }

    const adapter = adapterRegistry.get(engineId);
    if (!adapter) {
      debug('[MCP:writer] No adapter registered for: %s', engineId);
      return { success: true, engine: engineId, skipped: true };
    }

    // Fast path: check if already configured
    const configured = await adapter.isConfigured(workingDir, 'user');
    if (configured) {
      debug('[MCP:writer] Already configured for: %s', engineId);
      return { success: true, engine: engineId, skipped: true };
    }

    // Write config (one-time cost)
    debug('[MCP:writer] Writing config for: %s', engineId);
    await adapter.configure(workingDir, 'user');

    return { success: true, engine: engineId, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debug('[MCP:writer] Failed for %s: %s', engineId, message);
    return { success: false, engine: engineId, error: message };
  }
}

/**
 * Remove MCP config for an engine
 *
 * Called on logout or cleanup.
 */
export async function removeMCPConfig(
  engineId: string,
  workingDir: string
): Promise<MCPWriteResult> {
  try {
    const { adapterRegistry } = await import('./registry.js');

    try {
      await import(`../engines/providers/${engineId}/mcp/index.js`);
    } catch {
      return { success: true, engine: engineId, skipped: true };
    }

    const adapter = adapterRegistry.get(engineId);
    if (!adapter) {
      return { success: true, engine: engineId, skipped: true };
    }

    await adapter.cleanup(workingDir, 'user');
    debug('[MCP:writer] Removed config for: %s', engineId);

    return { success: true, engine: engineId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debug('[MCP:writer] Cleanup failed for %s: %s', engineId, message);
    return { success: false, engine: engineId, error: message };
  }
}
