import { describe, expect, it, beforeEach } from 'bun:test'

import {
  LRUCache,
  createLRUCache,
  createPromptCache,
  createTelemetryCache,
  createSessionCache,
  memoize,
  memoizeAsync,
} from '../../../src/infrastructure/cache/lru-cache'

// ============================================================================
// Tests
// ============================================================================

describe('LRUCache', () => {
  describe('Basic Operations', () => {
    let cache: LRUCache<string>

    beforeEach(() => {
      cache = new LRUCache({ maxSize: 3 })
    })

    it('sets and gets a value', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('returns undefined for non-existent key', () => {
      expect(cache.get('non-existent')).toBeUndefined()
    })

    it('overwrites existing value', () => {
      cache.set('key1', 'value1')
      cache.set('key1', 'value2')
      expect(cache.get('key1')).toBe('value2')
    })

    it('tracks cache size', () => {
      expect(cache.size).toBe(0)
      cache.set('key1', 'value1')
      expect(cache.size).toBe(1)
      cache.set('key2', 'value2')
      expect(cache.size).toBe(2)
    })

    it('checks if key exists', () => {
      cache.set('key1', 'value1')
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(false)
    })

    it('deletes a key', () => {
      cache.set('key1', 'value1')
      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeUndefined()
    })

    it('returns false when deleting non-existent key', () => {
      expect(cache.delete('non-existent')).toBe(false)
    })

    it('clears all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()
      expect(cache.size).toBe(0)
      expect(cache.get('key1')).toBeUndefined()
    })

    it('returns all keys', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      const keys = cache.keys()
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
    })

    it('returns all values', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      const values = cache.values()
      expect(values).toContain('value1')
      expect(values).toContain('value2')
    })
  })

  describe('LRU Eviction', () => {
    let cache: LRUCache<string>
    let evictedKeys: string[]

    beforeEach(() => {
      evictedKeys = []
      cache = new LRUCache({
        maxSize: 3,
        onEvict: (key) => evictedKeys.push(key),
      })
    })

    it('evicts oldest entry when at capacity', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      cache.set('key4', 'value4') // Should evict key1

      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key4')).toBe('value4')
      expect(evictedKeys).toContain('key1')
    })

    it('moves accessed entry to end (most recently used)', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Access key1 to make it most recently used
      cache.get('key1')

      // Add new entry - should evict key2 (now oldest)
      cache.set('key4', 'value4')

      expect(cache.get('key1')).toBe('value1') // Should still exist
      expect(cache.get('key2')).toBeUndefined() // Should be evicted
      expect(evictedKeys).toContain('key2')
    })

    it('calls onEvict callback when entry is evicted', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      cache.set('key4', 'value4')

      expect(evictedKeys).toEqual(['key1'])
    })

    it('tracks eviction count in metrics', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      cache.set('key4', 'value4')
      cache.set('key5', 'value5')

      const metrics = cache.getMetrics()
      expect(metrics.evictions).toBe(2)
    })
  })

  describe('TTL (Time To Live)', () => {
    it('expires entries after TTL', async () => {
      const cache = new LRUCache<string>({
        maxSize: 10,
        ttl: 50, // 50ms
      })

      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 60))

      expect(cache.get('key1')).toBeUndefined()
    })

    it('supports per-entry TTL', async () => {
      const cache = new LRUCache<string>({
        maxSize: 10,
        ttl: 1000, // Default 1s
      })

      cache.set('key1', 'value1', 50) // 50ms TTL
      cache.set('key2', 'value2') // Default TTL

      await new Promise(resolve => setTimeout(resolve, 60))

      expect(cache.get('key1')).toBeUndefined() // Expired
      expect(cache.get('key2')).toBe('value2') // Still valid
    })

    it('has() respects TTL', async () => {
      const cache = new LRUCache<string>({
        maxSize: 10,
        ttl: 50,
      })

      cache.set('key1', 'value1')
      expect(cache.has('key1')).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 60))

      expect(cache.has('key1')).toBe(false)
    })

    it('cleanup removes expired entries', async () => {
      const cache = new LRUCache<string>({
        maxSize: 10,
        ttl: 50,
      })

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      await new Promise(resolve => setTimeout(resolve, 60))

      const cleanedCount = cache.cleanup()
      expect(cleanedCount).toBe(3)
      expect(cache.size).toBe(0)
    })

    it('values() excludes expired entries', async () => {
      const cache = new LRUCache<string>({
        maxSize: 10,
        ttl: 50,
      })

      cache.set('key1', 'value1', 50) // Short TTL
      cache.set('key2', 'value2', 5000) // Long TTL

      await new Promise(resolve => setTimeout(resolve, 60))

      const values = cache.values()
      expect(values).toEqual(['value2'])
    })
  })

  describe('Metrics', () => {
    let cache: LRUCache<string>

    beforeEach(() => {
      cache = new LRUCache({ maxSize: 5 })
    })

    it('tracks hits and misses', () => {
      cache.set('key1', 'value1')

      cache.get('key1') // Hit
      cache.get('key1') // Hit
      cache.get('key2') // Miss
      cache.get('key3') // Miss

      const metrics = cache.getMetrics()
      expect(metrics.hits).toBe(2)
      expect(metrics.misses).toBe(2)
    })

    it('calculates hit rate', () => {
      cache.set('key1', 'value1')

      cache.get('key1') // Hit
      cache.get('key1') // Hit
      cache.get('key2') // Miss
      cache.get('key3') // Miss

      const hitRate = cache.getHitRate()
      expect(hitRate).toBe(0.5) // 2 hits / 4 total
    })

    it('returns 0 hit rate when no accesses', () => {
      expect(cache.getHitRate()).toBe(0)
    })

    it('tracks current size and max size', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const metrics = cache.getMetrics()
      expect(metrics.size).toBe(2)
      expect(metrics.maxSize).toBe(5)
    })
  })

  describe('Pattern Invalidation', () => {
    let cache: LRUCache<string>

    beforeEach(() => {
      cache = new LRUCache({ maxSize: 10 })
      cache.set('user:1:profile', 'profile1')
      cache.set('user:1:settings', 'settings1')
      cache.set('user:2:profile', 'profile2')
      cache.set('post:1', 'post1')
      cache.set('post:2', 'post2')
    })

    it('invalidates entries matching pattern', () => {
      const count = cache.invalidatePattern(/^user:1:/)
      expect(count).toBe(2)
      expect(cache.get('user:1:profile')).toBeUndefined()
      expect(cache.get('user:1:settings')).toBeUndefined()
      expect(cache.get('user:2:profile')).toBe('profile2')
    })

    it('invalidates entries with prefix', () => {
      const count = cache.invalidatePrefix('post:')
      expect(count).toBe(2)
      expect(cache.get('post:1')).toBeUndefined()
      expect(cache.get('post:2')).toBeUndefined()
      expect(cache.get('user:1:profile')).toBe('profile1')
    })

    it('returns count of invalidated entries', () => {
      const patternCount = cache.invalidatePattern(/^user:/)
      expect(patternCount).toBe(3)

      const prefixCount = cache.invalidatePrefix('post:')
      expect(prefixCount).toBe(2)
    })
  })
})

describe('Factory Functions', () => {
  it('creates cache with createLRUCache', () => {
    const cache = createLRUCache<string>({ maxSize: 10 })
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')
  })

  it('creates prompt cache with default settings', () => {
    const cache = createPromptCache<string>()
    expect(cache).toBeInstanceOf(LRUCache)
  })

  it('creates telemetry cache with default settings', () => {
    const cache = createTelemetryCache<string>()
    expect(cache).toBeInstanceOf(LRUCache)
  })

  it('creates session cache with default settings', () => {
    const cache = createSessionCache<string>()
    expect(cache).toBeInstanceOf(LRUCache)
  })
})

describe('Memoization', () => {
  describe('memoize (sync)', () => {
    it('caches function results', () => {
      let callCount = 0
      const fn = (x: number) => {
        callCount++
        return x * 2
      }

      const memoized = memoize(fn)

      expect(memoized(5)).toBe(10)
      expect(memoized(5)).toBe(10) // Cached
      expect(callCount).toBe(1)
    })

    it('caches with multiple arguments', () => {
      let callCount = 0
      const fn = (a: number, b: number) => {
        callCount++
        return a + b
      }

      const memoized = memoize(fn)

      expect(memoized(2, 3)).toBe(5)
      expect(memoized(2, 3)).toBe(5) // Cached
      expect(memoized(3, 2)).toBe(5) // Different args, new call
      expect(callCount).toBe(2)
    })

    it('supports custom key function', () => {
      let callCount = 0
      const fn = (obj: { id: number }) => {
        callCount++
        return obj.id * 2
      }

      const memoized = memoize(fn, {
        keyFn: (obj) => String(obj.id),
      })

      expect(memoized({ id: 1 })).toBe(2)
      expect(memoized({ id: 1 })).toBe(2) // Cached by id
      expect(callCount).toBe(1)
    })

    it('respects maxSize option', () => {
      let callCount = 0
      const fn = (x: number) => {
        callCount++
        return x * 2
      }

      const memoized = memoize(fn, { maxSize: 2 })

      memoized(1) // Cache: [1]
      memoized(2) // Cache: [1, 2]
      memoized(3) // Cache: [2, 3] - 1 evicted
      memoized(1) // Cache: [3, 1] - recalculated

      expect(callCount).toBe(4) // 1, 2, 3, 1 again
    })

    it('respects TTL option', async () => {
      let callCount = 0
      const fn = (x: number) => {
        callCount++
        return x * 2
      }

      const memoized = memoize(fn, { ttl: 50 })

      expect(memoized(5)).toBe(10)
      expect(callCount).toBe(1)

      await new Promise(resolve => setTimeout(resolve, 60))

      expect(memoized(5)).toBe(10)
      expect(callCount).toBe(2) // Recalculated after TTL
    })
  })

  describe('memoizeAsync', () => {
    it('caches async function results', async () => {
      let callCount = 0
      const fn = async (x: number) => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 10))
        return x * 2
      }

      const memoized = memoizeAsync(fn)

      expect(await memoized(5)).toBe(10)
      expect(await memoized(5)).toBe(10) // Cached
      expect(callCount).toBe(1)
    })

    it('deduplicates concurrent requests', async () => {
      let callCount = 0
      const fn = async (x: number) => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 50))
        return x * 2
      }

      const memoized = memoizeAsync(fn)

      // Fire multiple concurrent requests
      const results = await Promise.all([
        memoized(5),
        memoized(5),
        memoized(5),
      ])

      expect(results).toEqual([10, 10, 10])
      expect(callCount).toBe(1) // Only one actual call
    })

    it('handles errors and allows retry', async () => {
      let callCount = 0
      const fn = async (x: number) => {
        callCount++
        if (callCount === 1) {
          throw new Error('First call fails')
        }
        return x * 2
      }

      const memoized = memoizeAsync(fn)

      await expect(memoized(5)).rejects.toThrow('First call fails')
      expect(await memoized(5)).toBe(10) // Retry succeeds
      expect(callCount).toBe(2)
    })

    it('supports custom key function', async () => {
      let callCount = 0
      const fn = async (obj: { id: number }) => {
        callCount++
        return obj.id * 2
      }

      const memoized = memoizeAsync(fn, {
        keyFn: (obj) => String(obj.id),
      })

      expect(await memoized({ id: 1 })).toBe(2)
      expect(await memoized({ id: 1 })).toBe(2) // Cached
      expect(callCount).toBe(1)
    })
  })
})

describe('Edge Cases', () => {
  it('handles undefined and null values', () => {
    const cache = new LRUCache<string | null | undefined>({ maxSize: 5 })

    cache.set('null', null)
    cache.set('undefined', undefined)

    // Note: undefined values can't be distinguished from cache miss
    expect(cache.get('null')).toBeNull()
    expect(cache.has('null')).toBe(true)
    expect(cache.has('undefined')).toBe(true)
  })

  it('handles complex objects as values', () => {
    const cache = new LRUCache<{ name: string; data: number[] }>({ maxSize: 5 })

    const value = { name: 'test', data: [1, 2, 3] }
    cache.set('obj', value)

    const retrieved = cache.get('obj')
    expect(retrieved).toEqual(value)
    expect(retrieved).toBe(value) // Same reference
  })

  it('handles empty string keys', () => {
    const cache = new LRUCache<string>({ maxSize: 5 })

    cache.set('', 'empty key')
    expect(cache.get('')).toBe('empty key')
  })

  it('handles special characters in keys', () => {
    const cache = new LRUCache<string>({ maxSize: 5 })

    cache.set('key:with:colons', 'value1')
    cache.set('key/with/slashes', 'value2')
    cache.set('key with spaces', 'value3')

    expect(cache.get('key:with:colons')).toBe('value1')
    expect(cache.get('key/with/slashes')).toBe('value2')
    expect(cache.get('key with spaces')).toBe('value3')
  })

  it('handles maxSize of 1', () => {
    const cache = new LRUCache<string>({ maxSize: 1 })

    cache.set('key1', 'value1')
    expect(cache.get('key1')).toBe('value1')

    cache.set('key2', 'value2')
    expect(cache.get('key1')).toBeUndefined()
    expect(cache.get('key2')).toBe('value2')
  })
})
