/**
 * Engine Registry - Auto-discovers and manages engine plugins
 */

import type { EngineModule, EngineMetadata } from './base.js';
import { isEngineModule } from './base.js';

// Import all engines at compile time
import codexEngine from '../providers/codex/index.js';
import claudeEngine from '../providers/claude/index.js';
import cursorEngine from '../providers/cursor/index.js';
import ccrEngine from '../providers/ccr/index.js';
import opencodeEngine from '../providers/opencode/index.js';
import auggieEngine from '../providers/auggie/index.js';
import mistralEngine from '../providers/mistral/index.js';
import copilotEngine from '../providers/copilot/index.js';

/**
 * Engine Registry - Singleton that manages all available engines
 */
class EngineRegistry {
  private engines = new Map<string, EngineModule>();
  private initialized = false;

  /**
   * Initialize and register all available engines
   * This happens at module load time
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return; // Already initialized
    }

    // Register all known engines
    // To add a new engine: import it above and register it here
    const engineModules = [
      opencodeEngine,
      claudeEngine,
      copilotEngine,
      codexEngine,
      cursorEngine,
      mistralEngine,
      auggieEngine,
      ccrEngine,
      // Add new engines here
    ];

    for (const engineModule of engineModules) {
      try {
        if (isEngineModule(engineModule)) {
          this.register(engineModule);
        } else {
          console.warn('Invalid engine module:', engineModule);
        }
      } catch (error) {
        console.warn('Failed to register engine:', error instanceof Error ? error.message : String(error));
      }
    }

    this.initialized = true;
  }

  /**
   * Manually register an engine
   */
  register(engine: EngineModule): void {
    const id = engine.metadata.id;

    if (this.engines.has(id)) {
      console.warn(`Engine "${id}" is already registered. Skipping.`);
      return;
    }

    this.engines.set(id, engine);

    // Call onRegister hook if provided
    engine.onRegister?.();
  }

  /**
   * Get an engine by ID
   */
  get(id: string): EngineModule | undefined {
    return this.engines.get(id);
  }

  /**
   * Get all registered engines, sorted by order
   */
  getAll(): EngineModule[] {
    return Array.from(this.engines.values())
      .sort((a, b) => (a.metadata.order ?? 99) - (b.metadata.order ?? 99));
  }

  /**
   * Get all engine IDs
   */
  getAllIds(): string[] {
    return Array.from(this.engines.keys());
  }

  /**
   * Get all engine metadata
   */
  getAllMetadata(): EngineMetadata[] {
    return this.getAll().map(engine => engine.metadata);
  }

  /**
   * Check if an engine is registered
   */
  has(id: string): boolean {
    return this.engines.has(id);
  }

  /**
   * Get the default engine (first by order)
   */
  getDefault(): EngineModule | undefined {
    return this.getAll()[0];
  }

  /**
   * Clear all engines (mainly for testing)
   */
  clear(): void {
    this.engines.clear();
    this.initialized = false;
  }
}

// Export singleton instance
export const registry = new EngineRegistry();

// Initialize on module load
await registry.initialize();
