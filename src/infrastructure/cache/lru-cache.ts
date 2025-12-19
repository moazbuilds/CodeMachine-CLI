/**
 * LRU Cache with TTL
 *
 * A simple, efficient Least Recently Used cache with time-to-live support.
 *
 * Features:
 * - O(1) get/set operations
 * - Configurable max size
 * - Per-entry TTL
 * - Automatic eviction
 * - Invalidation by key or pattern
 * - Metrics tracking
 */

// ============================================================================
// Types
// ============================================================================

export interface LRUCacheOptions<T> {
  /** Maximum number of entries */
  maxSize: number
  /** Default TTL in milliseconds (0 = no expiry) */
  ttl?: number
  /** Callback when entry is evicted */
  onEvict?: (key: string, value: T) => void
}

export interface CacheEntry<T> {
  value: T
  expiresAt: number | null
  createdAt: number
}

export interface CacheMetrics {
  hits: number
  misses: number
  evictions: number
  size: number
  maxSize: number
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

export class LRUCache<T> {
  private readonly maxSize: number
  private readonly defaultTTL: number
  private readonly onEvict?: (key: string, value: T) => void

  // Using Map preserves insertion order, making it ideal for LRU
  private cache = new Map<string, CacheEntry<T>>()

  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    maxSize: 0,
  }

  constructor(options: LRUCacheOptions<T>) {
    this.maxSize = options.maxSize
    this.defaultTTL = options.ttl ?? 0
    this.onEvict = options.onEvict
    this.metrics.maxSize = options.maxSize
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.metrics.misses++
      return undefined
    }

    // Check expiry
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.delete(key)
      this.metrics.misses++
      return undefined
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    this.metrics.hits++
    return entry.value
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Evict oldest if at capacity
    while (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    // Calculate expiry
    const effectiveTTL = ttl ?? this.defaultTTL
    const expiresAt = effectiveTTL > 0 ? Date.now() + effectiveTTL : null

    // Add entry
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    })

    this.metrics.size = this.cache.size
  }

  /**
   * Check if key exists (without updating LRU order)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    // Check expiry
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    this.cache.delete(key)
    this.metrics.size = this.cache.size

    if (this.onEvict) {
      this.onEvict(key, entry.value)
    }

    return true
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key)
        count++
      }
    }

    return count
  }

  /**
   * Invalidate entries with a prefix
   */
  invalidatePrefix(prefix: string): number {
    let count = 0

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.delete(key)
        count++
      }
    }

    return count
  }

  /**
   * Clear all entries
   */
  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.cache) {
        this.onEvict(key, entry.value)
      }
    }

    this.cache.clear()
    this.metrics.size = 0
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get all values
   */
  values(): T[] {
    const now = Date.now()
    const values: T[] = []

    for (const entry of this.cache.values()) {
      if (entry.expiresAt === null || now <= entry.expiresAt) {
        values.push(entry.value)
      }
    }

    return values
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Get metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics }
  }

  /**
   * Get hit rate
   */
  getHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses
    return total > 0 ? this.metrics.hits / total : 0
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let count = 0

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.delete(key)
        count++
      }
    }

    return count
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private evictOldest(): void {
    // Map iteration order is insertion order, so first key is oldest
    const oldestKey = this.cache.keys().next().value

    if (oldestKey !== undefined) {
      const entry = this.cache.get(oldestKey)
      this.cache.delete(oldestKey)
      this.metrics.evictions++
      this.metrics.size = this.cache.size

      if (entry && this.onEvict) {
        this.onEvict(oldestKey, entry.value)
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createLRUCache = <T>(options: LRUCacheOptions<T>): LRUCache<T> => {
  return new LRUCache(options)
}

// ============================================================================
// Specialized Caches
// ============================================================================

/**
 * Create a prompt cache (for parsed prompts)
 */
export const createPromptCache = <T>(): LRUCache<T> => {
  return new LRUCache<T>({
    maxSize: 100,
    ttl: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Create a telemetry cache (for aggregated metrics)
 */
export const createTelemetryCache = <T>(): LRUCache<T> => {
  return new LRUCache<T>({
    maxSize: 50,
    ttl: 10 * 1000, // 10 seconds
  })
}

/**
 * Create a session cache (for agent sessions)
 */
export const createSessionCache = <T>(): LRUCache<T> => {
  return new LRUCache<T>({
    maxSize: 20,
    ttl: 30 * 60 * 1000, // 30 minutes
  })
}

// ============================================================================
// Memoization Helper
// ============================================================================

/**
 * Create a memoized function with LRU cache
 */
export const memoize = <Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
  options: {
    maxSize?: number
    ttl?: number
    keyFn?: (...args: Args) => string
  } = {}
): ((...args: Args) => Result) => {
  const cache = new LRUCache<Result>({
    maxSize: options.maxSize ?? 100,
    ttl: options.ttl,
  })

  const keyFn = options.keyFn ?? ((...args: Args) => JSON.stringify(args))

  return (...args: Args): Result => {
    const key = keyFn(...args)
    const cached = cache.get(key)

    if (cached !== undefined) {
      return cached
    }

    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}

/**
 * Create an async memoized function with LRU cache
 */
export const memoizeAsync = <Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: {
    maxSize?: number
    ttl?: number
    keyFn?: (...args: Args) => string
  } = {}
): ((...args: Args) => Promise<Result>) => {
  const cache = new LRUCache<Result>({
    maxSize: options.maxSize ?? 100,
    ttl: options.ttl,
  })

  const pending = new Map<string, Promise<Result>>()
  const keyFn = options.keyFn ?? ((...args: Args) => JSON.stringify(args))

  return async (...args: Args): Promise<Result> => {
    const key = keyFn(...args)

    // Check cache
    const cached = cache.get(key)
    if (cached !== undefined) {
      return cached
    }

    // Check pending requests (avoid duplicate requests)
    const pendingRequest = pending.get(key)
    if (pendingRequest) {
      return pendingRequest
    }

    // Execute and cache
    const promise = fn(...args).then((result) => {
      cache.set(key, result)
      pending.delete(key)
      return result
    }).catch((error) => {
      pending.delete(key)
      throw error
    })

    pending.set(key, promise)
    return promise
  }
}
