/**
 * Cache Module
 *
 * Provides caching utilities for performance optimization.
 */

// LRU Cache
export {
  LRUCache,
  createLRUCache,
  createPromptCache,
  createTelemetryCache,
  createSessionCache,
  memoize,
  memoizeAsync,
  type LRUCacheOptions,
  type CacheEntry,
  type CacheMetrics,
} from './lru-cache.js'

// Query Cache
export {
  QueryCache,
  createTelemetryQueryCache,
  createWorkflowQueryCache,
  createAgentQueryCache,
  getTelemetryCache,
  getWorkflowCache,
  getAgentCache,
  resetQueryCaches,
  type QueryCacheConfig,
  type InvalidationRule,
  type QueryCacheStats,
} from './query-cache.js'
