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
  debug(`[DEBUG workflow] step.engine=${step.engine}`);

  // Determine engine: step override > first authenticated engine
  let engineType: string;
  if (step.engine) {
    debug(`[DEBUG workflow] Using step-specified engine: ${step.engine}`);
    engineType = step.engine;

    // If an override is provided but not authenticated, log and fall back
    const overrideEngine = registry.get(engineType);
    debug(`[DEBUG workflow] Checking auth for override engine...`);
    const isOverrideAuthed = overrideEngine
      ? await authCache.isAuthenticated(overrideEngine.metadata.id, () => overrideEngine.auth.isAuthenticated())
      : false;
    debug(`[DEBUG workflow] isOverrideAuthed=${isOverrideAuthed}`);
    if (!isOverrideAuthed) {
      const pretty = overrideEngine?.metadata.name ?? engineType;
      const authMsg = `${pretty} override is not authenticated; falling back to first authenticated engine by order. Run 'codemachine auth login' to use ${pretty}.`;
      emitter.logMessage(uniqueAgentId, authMsg);

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
        engineType = fallbackEngine.metadata.id;
        const fallbackMsg = `Falling back to ${fallbackEngine.metadata.name} (${engineType})`;
        emitter.logMessage(uniqueAgentId, fallbackMsg);
      }
    }
  } else {
    debug(`[DEBUG workflow] No step.engine specified, finding authenticated engine...`);
    // Fallback: find first authenticated engine by order (with caching)
    const engines = registry.getAll();
    debug(`[DEBUG workflow] Available engines: ${engines.map(e => e.metadata.id).join(', ')}`);
    let foundEngine = null;

    for (const engine of engines) {
      debug(`[DEBUG workflow] Checking auth for engine: ${engine.metadata.id}`);
      const isAuth = await authCache.isAuthenticated(
        engine.metadata.id,
        () => engine.auth.isAuthenticated()
      );
      debug(`[DEBUG workflow] Engine ${engine.metadata.id} isAuth=${isAuth}`);
      if (isAuth) {
        foundEngine = engine;
        break;
      }
    }

    if (!foundEngine) {
      debug(`[DEBUG workflow] No authenticated engine found, using default`);
      // If no authenticated engine, use default (first by order)
      foundEngine = registry.getDefault();
    }

    if (!foundEngine) {
      debug(`[DEBUG workflow] No engines registered at all!`);
      throw new Error('No engines registered. Please install at least one engine.');
    }

    engineType = foundEngine.metadata.id;
    debug(`[DEBUG workflow] Selected engine: ${engineType}`);
    const engineMsg = `No engine specified, using ${foundEngine.metadata.name} (${engineType})`;
    emitter.logMessage(uniqueAgentId, engineMsg);
  }

  debug(`[DEBUG workflow] Engine determined: ${engineType}`);
  return engineType;
}
