/**
 * MCP Adapter Registry
 *
 * Central registry that manages engine MCP adapters.
 * Each engine registers its adapter when its mcp/index.ts is imported.
 *
 * Usage:
 *   // In engine's mcp/index.ts
 *   import { adapterRegistry } from '../../../../mcp/registry.js';
 *   adapterRegistry.register(myAdapter);
 */

import type { MCPAdapter } from './types.js';

// ============================================================================
// REGISTRY CLASS
// ============================================================================

class AdapterRegistry {
  private adapters = new Map<string, MCPAdapter>();

  /**
   * Register an adapter
   *
   * Called by each engine's mcp/index.ts at import time.
   * No debug logs here - registration happens before debug log file is set up.
   */
  register(adapter: MCPAdapter): void {
    if (this.adapters.has(adapter.id)) {
      return;
    }
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Get an adapter by ID
   */
  get(id: string): MCPAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Get all registered adapters
   */
  getAll(): MCPAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get all registered adapter IDs
   */
  getAllIds(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if an adapter is registered
   */
  has(id: string): boolean {
    return this.adapters.has(id);
  }

  /**
   * Get count of registered adapters
   */
  get size(): number {
    return this.adapters.size;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const adapterRegistry = new AdapterRegistry();
