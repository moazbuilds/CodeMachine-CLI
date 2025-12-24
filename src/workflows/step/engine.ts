/**
 * Engine Selection
 *
 * Selects the appropriate engine for step execution with fallback logic.
 */

import { registry } from '../../infra/engines/index.js';
import { debug } from '../../shared/logging/logger.js';
import type { WorkflowEventEmitter } from '../events/index.js';

/**
 * Cache for engine authentication status with TTL
 * Prevents repeated auth checks (which can take 10-30 seconds)
 */
export class EngineAuthCache {
  private cache: Map<string, { isAuthenticated: boolean; timestamp: number }> = new Map();
  private ttlMs: number = 5 * 60 * 1000; // 5 minutes TTL

  /**
   * Check if engine is authenticated (with caching)
   */
  async isAuthenticated(engineId: string, checkFn: () => Promise<boolean>): Promise<boolean> {
    const cached = this.cache.get(engineId);
    const now = Date.now();

    // Return cached value if still valid
    if (cached && (now - cached.timestamp) < this.ttlMs) {
      return cached.isAuthenticated;
    }

    // Cache miss or expired - perform actual check
    const result = await checkFn();

    // Cache the result
    this.cache.set(engineId, {
      isAuthenticated: result,
      timestamp: now
    });

    return result;
  }

  /**
   * Invalidate cache for specific engine
   */
  invalidate(engineId: string): void {
    this.cache.delete(engineId);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global auth cache instance
export const authCache = new EngineAuthCache();

interface StepWithEngine {
  engine?: string;
  agentId: string;
  agentName?: string;
}

/**
 * Select engine for step execution with fallback logic
 */
export async function selectEngine(
  step: StepWithEngine,
  emitter: WorkflowEventEmitter,
  uniqueAgentId: string
): Promise<string> {
  debug(`[step/engine] step.engine=${step.engine}`);

  // Determine engine: step override > first authenticated engine
  let engineType: string;
  if (step.engine) {
    debug(`[step/engine] Using step-specified engine: ${step.engine}`);
    engineType = step.engine;

    // If an override is provided but not authenticated, log and fall back
    const overrideEngine = registry.get(engineType);
    debug(`[step/engine] Checking auth for override engine...`);
    const isOverrideAuthed = overrideEngine
      ? await authCache.isAuthenticated(overrideEngine.metadata.id, () => overrideEngine.auth.isAuthenticated())
      : false;
    debug(`[step/engine] isOverrideAuthed=${isOverrideAuthed}`);
    if (!isOverrideAuthed) {
      // Find first authenticated engine by order (with caching)
      const engines = registry.getAll();
      let fallbackEngine = null as typeof overrideEngine | null;
      for (const eng of engines) {
        const isAuth = await authCache.isAuthenticated(
          eng.metadata.id,
          () => eng.auth.isAuthenticated()
        );
        if (isAuth) {
          fallbackEngine = eng;
          break;
        }
      }

      // If none authenticated, fall back to registry default (may still require auth)
      if (!fallbackEngine) {
        fallbackEngine = registry.getDefault() ?? null;
      }

      if (fallbackEngine) {
        const pretty = overrideEngine?.metadata.name ?? engineType;
        emitter.logMessage(uniqueAgentId, `${pretty} not authenticated. Fallback to ${fallbackEngine.metadata.name}. Run /login to connect.`);
        engineType = fallbackEngine.metadata.id;
      }
    }
  } else {
    debug(`[step/engine] No step.engine specified, finding authenticated engine...`);
    // Fallback: find first authenticated engine by order (with caching)
    const engines = registry.getAll();
    debug(`[step/engine] Available engines: ${engines.map(e => e.metadata.id).join(', ')}`);
    let foundEngine = null;

    for (const engine of engines) {
      debug(`[step/engine] Checking auth for engine: ${engine.metadata.id}`);
      const isAuth = await authCache.isAuthenticated(
        engine.metadata.id,
        () => engine.auth.isAuthenticated()
      );
      debug(`[step/engine] Engine ${engine.metadata.id} isAuth=${isAuth}`);
      if (isAuth) {
        foundEngine = engine;
        break;
      }
    }

    if (!foundEngine) {
      debug(`[step/engine] No authenticated engine found, using default`);
      // If no authenticated engine, use default (first by order)
      foundEngine = registry.getDefault();
    }

    if (!foundEngine) {
      debug(`[step/engine] No engines registered at all!`);
      throw new Error('No engines registered. Please install at least one engine.');
    }

    engineType = foundEngine.metadata.id;
    debug(`[step/engine] Selected engine: ${engineType}`);
  }

  debug(`[step/engine] Engine determined: ${engineType}`);
  return engineType;
}
