/**
 * Query Cache
 *
 * Caches database query results with event-based invalidation.
 * Integrates with the event bus to automatically invalidate stale data.
 */

import type { IEventBus } from '../events/event-bus.js'
import { getEventBus } from '../events/event-bus.js'
import type { DomainEvent } from '../events/event-types.js'
import { LRUCache, type LRUCacheOptions, type CacheMetrics } from './lru-cache.js'
import type { Unsubscribe } from '../../shared/types/index.js'

// ============================================================================
// Types
// ============================================================================

export interface QueryCacheConfig {
  /** Maximum number of cached queries */
  maxSize?: number
  /** Default TTL in milliseconds */
  ttl?: number
  /** Event bus for invalidation */
  eventBus?: IEventBus
  /** Namespace for cache keys */
  namespace?: string
}

export interface InvalidationRule {
  /** Event type that triggers invalidation */
  eventType: string
  /** Pattern to match cache keys (optional - if not provided, invalidates all) */
  keyPattern?: RegExp
  /** Function to generate key pattern from event (optional) */
  keyFromEvent?: (event: DomainEvent) => string | RegExp | null
}

export interface QueryCacheStats extends CacheMetrics {
  invalidations: number
  namespace: string
}

// ============================================================================
// Query Cache Implementation
// ============================================================================

export class QueryCache<T = unknown> {
  private cache: LRUCache<T>
  private eventBus: IEventBus
  private namespace: string
  private unsubscribes: Unsubscribe[] = []
  private invalidationRules: InvalidationRule[] = []
  private invalidationCount = 0

  constructor(config: QueryCacheConfig = {}) {
    this.namespace = config.namespace ?? 'query'
    this.eventBus = config.eventBus ?? getEventBus()

    this.cache = new LRUCache<T>({
      maxSize: config.maxSize ?? 500,
      ttl: config.ttl ?? 60_000, // 1 minute default
    })
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Get a cached query result
   */
  get(key: string): T | undefined {
    return this.cache.get(this.prefixKey(key))
  }

  /**
   * Set a query result in cache
   */
  set(key: string, value: T, ttl?: number): void {
    this.cache.set(this.prefixKey(key), value, ttl)
  }

  /**
   * Get or fetch a query result
   * If not cached, executes the fetch function and caches the result
   */
  async getOrFetch(
    key: string,
    fetch: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key)
    if (cached !== undefined) {
      return cached
    }

    const result = await fetch()
    this.set(key, result, ttl)
    return result
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return this.cache.has(this.prefixKey(key))
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(this.prefixKey(key))
  }

  /**
   * Invalidate keys matching a pattern
   */
  invalidatePattern(pattern: RegExp): number {
    const prefixedPattern = new RegExp(`^${this.namespace}:${pattern.source}`)
    const count = this.cache.invalidatePattern(prefixedPattern)
    this.invalidationCount += count
    return count
  }

  /**
   * Invalidate keys with a prefix
   */
  invalidatePrefix(prefix: string): number {
    const count = this.cache.invalidatePrefix(this.prefixKey(prefix))
    this.invalidationCount += count
    return count
  }

  /**
   * Clear all cached queries
   */
  clear(): void {
    this.cache.invalidatePrefix(`${this.namespace}:`)
    this.invalidationCount++
  }

  // ============================================================================
  // Event-Based Invalidation
  // ============================================================================

  /**
   * Add an invalidation rule
   */
  addInvalidationRule(rule: InvalidationRule): void {
    this.invalidationRules.push(rule)

    // Subscribe to event
    const unsub = this.eventBus.subscribe(rule.eventType, (event) => {
      this.handleInvalidationEvent(event, rule)
    })

    this.unsubscribes.push(unsub)
  }

  /**
   * Configure invalidation for common patterns
   */
  invalidateOnEvents(
    events: Array<{ type: string; pattern?: RegExp | string }>
  ): void {
    for (const { type, pattern } of events) {
      this.addInvalidationRule({
        eventType: type,
        keyPattern:
          typeof pattern === 'string' ? new RegExp(pattern) : pattern,
      })
    }
  }

  /**
   * Handle an invalidation event
   */
  private handleInvalidationEvent(
    event: DomainEvent,
    rule: InvalidationRule
  ): void {
    if (rule.keyFromEvent) {
      const keyOrPattern = rule.keyFromEvent(event)
      if (keyOrPattern === null) return

      if (typeof keyOrPattern === 'string') {
        this.delete(keyOrPattern)
        this.invalidationCount++
      } else {
        this.invalidatePattern(keyOrPattern)
      }
    } else if (rule.keyPattern) {
      this.invalidatePattern(rule.keyPattern)
    } else {
      // Invalidate all if no pattern specified
      this.clear()
    }
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get cache statistics
   */
  getStats(): QueryCacheStats {
    const metrics = this.cache.getMetrics()
    return {
      ...metrics,
      invalidations: this.invalidationCount,
      namespace: this.namespace,
    }
  }

  /**
   * Get hit rate
   */
  getHitRate(): number {
    return this.cache.getHitRate()
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Cleanup (remove event subscriptions)
   */
  dispose(): void {
    for (const unsub of this.unsubscribes) {
      unsub()
    }
    this.unsubscribes = []
    this.invalidationRules = []
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private prefixKey(key: string): string {
    return `${this.namespace}:${key}`
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a query cache for telemetry data
 */
export function createTelemetryQueryCache(): QueryCache {
  const cache = new QueryCache({
    namespace: 'telemetry',
    maxSize: 100,
    ttl: 30_000, // 30 seconds
  })

  // Invalidate on telemetry events
  cache.invalidateOnEvents([
    { type: 'telemetry:snapshot', pattern: /.*/ },
    { type: 'workflow:completed', pattern: /workflow:.*/ },
    { type: 'step:completed', pattern: /step:.*/ },
  ])

  return cache
}

/**
 * Create a query cache for workflow data
 */
export function createWorkflowQueryCache(): QueryCache {
  const cache = new QueryCache({
    namespace: 'workflow',
    maxSize: 50,
    ttl: 60_000, // 1 minute
  })

  // Invalidate on workflow events
  cache.invalidateOnEvents([
    { type: 'workflow:started', pattern: /list/ },
    { type: 'workflow:stopped', pattern: /.*/ },
    { type: 'step:completed', pattern: /.*/ },
  ])

  return cache
}

/**
 * Create a query cache for agent data
 */
export function createAgentQueryCache(): QueryCache {
  const cache = new QueryCache({
    namespace: 'agent',
    maxSize: 200,
    ttl: 120_000, // 2 minutes
  })

  // Invalidate on agent events
  cache.invalidateOnEvents([
    { type: 'agent:registered', pattern: /list/ },
    { type: 'agent:completed', pattern: /.*/ },
    { type: 'agent:telemetry', pattern: /telemetry:.*/ },
  ])

  return cache
}

// ============================================================================
// Singleton Caches
// ============================================================================

let telemetryCache: QueryCache | null = null
let workflowCache: QueryCache | null = null
let agentCache: QueryCache | null = null

export function getTelemetryCache(): QueryCache {
  if (!telemetryCache) {
    telemetryCache = createTelemetryQueryCache()
  }
  return telemetryCache
}

export function getWorkflowCache(): QueryCache {
  if (!workflowCache) {
    workflowCache = createWorkflowQueryCache()
  }
  return workflowCache
}

export function getAgentCache(): QueryCache {
  if (!agentCache) {
    agentCache = createAgentQueryCache()
  }
  return agentCache
}

export function resetQueryCaches(): void {
  telemetryCache?.dispose()
  telemetryCache = null
  workflowCache?.dispose()
  workflowCache = null
  agentCache?.dispose()
  agentCache = null
}
