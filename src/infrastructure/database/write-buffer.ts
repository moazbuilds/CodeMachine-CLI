/**
 * Write Buffer
 *
 * Batches database writes for improved performance.
 * Automatically flushes based on size threshold or time interval.
 */

// ============================================================================
// Types
// ============================================================================

export interface WriteBufferConfig<T> {
  /** Maximum items before auto-flush */
  maxSize?: number
  /** Flush interval in milliseconds */
  flushIntervalMs?: number
  /** Callback to write items to database */
  onFlush: (items: T[]) => Promise<void>
  /** Callback on flush error */
  onError?: (error: Error, items: T[]) => void
  /** Retry failed writes */
  retry?: {
    maxAttempts: number
    delayMs: number
  }
}

export interface WriteBufferStats {
  pendingItems: number
  totalFlushed: number
  flushCount: number
  errors: number
  lastFlushAt: number | null
}

// ============================================================================
// Write Buffer Implementation
// ============================================================================

export class WriteBuffer<T> {
  private buffer: T[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private flushing = false
  private disposed = false

  private readonly maxSize: number
  private readonly flushIntervalMs: number
  private readonly onFlush: (items: T[]) => Promise<void>
  private readonly onError?: (error: Error, items: T[]) => void
  private readonly retry?: { maxAttempts: number; delayMs: number }

  private stats: WriteBufferStats = {
    pendingItems: 0,
    totalFlushed: 0,
    flushCount: 0,
    errors: 0,
    lastFlushAt: null,
  }

  constructor(config: WriteBufferConfig<T>) {
    this.maxSize = config.maxSize ?? 100
    this.flushIntervalMs = config.flushIntervalMs ?? 1000
    this.onFlush = config.onFlush
    this.onError = config.onError
    this.retry = config.retry
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Add an item to the buffer
   */
  add(item: T): void {
    if (this.disposed) {
      throw new Error('WriteBuffer has been disposed')
    }

    this.buffer.push(item)
    this.stats.pendingItems = this.buffer.length

    // Flush immediately if buffer is full
    if (this.buffer.length >= this.maxSize) {
      void this.flush()
    } else {
      // Schedule flush
      this.scheduleFlush()
    }
  }

  /**
   * Add multiple items to the buffer
   */
  addBatch(items: T[]): void {
    if (this.disposed) {
      throw new Error('WriteBuffer has been disposed')
    }

    this.buffer.push(...items)
    this.stats.pendingItems = this.buffer.length

    // Flush immediately if buffer is full
    if (this.buffer.length >= this.maxSize) {
      void this.flush()
    } else {
      // Schedule flush
      this.scheduleFlush()
    }
  }

  /**
   * Flush all pending items immediately
   */
  async flush(): Promise<void> {
    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    // Check if already flushing or empty
    if (this.flushing || this.buffer.length === 0) {
      return
    }

    this.flushing = true

    // Take items from buffer
    const items = this.buffer
    this.buffer = []
    this.stats.pendingItems = 0

    try {
      await this.flushWithRetry(items)
      this.stats.totalFlushed += items.length
      this.stats.flushCount++
      this.stats.lastFlushAt = Date.now()
    } catch (error) {
      this.stats.errors++
      if (this.onError) {
        this.onError(error as Error, items)
      } else {
        console.error('[WriteBuffer] Flush failed:', error)
      }
    } finally {
      this.flushing = false
    }
  }

  /**
   * Get buffer statistics
   */
  getStats(): WriteBufferStats {
    return { ...this.stats }
  }

  /**
   * Get pending item count
   */
  get pendingCount(): number {
    return this.buffer.length
  }

  /**
   * Check if buffer is empty
   */
  get isEmpty(): boolean {
    return this.buffer.length === 0
  }

  /**
   * Dispose the buffer (flushes pending items)
   */
  async dispose(): Promise<void> {
    this.disposed = true

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    // Final flush
    await this.flush()
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private scheduleFlush(): void {
    if (this.flushTimer || this.flushing) {
      return
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, this.flushIntervalMs)
  }

  private async flushWithRetry(items: T[]): Promise<void> {
    if (!this.retry) {
      await this.onFlush(items)
      return
    }

    let lastError: Error | undefined
    for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt++) {
      try {
        await this.onFlush(items)
        return
      } catch (error) {
        lastError = error as Error
        if (attempt < this.retry.maxAttempts) {
          await this.delay(this.retry.delayMs * attempt) // Exponential backoff
        }
      }
    }

    throw lastError
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a write buffer for log entries
 */
export function createLogWriteBuffer<T>(
  onFlush: (items: T[]) => Promise<void>
): WriteBuffer<T> {
  return new WriteBuffer({
    maxSize: 50,
    flushIntervalMs: 500,
    onFlush,
    retry: {
      maxAttempts: 3,
      delayMs: 100,
    },
  })
}

/**
 * Create a write buffer for telemetry snapshots
 */
export function createTelemetryWriteBuffer<T>(
  onFlush: (items: T[]) => Promise<void>
): WriteBuffer<T> {
  return new WriteBuffer({
    maxSize: 100,
    flushIntervalMs: 1000,
    onFlush,
    retry: {
      maxAttempts: 2,
      delayMs: 200,
    },
  })
}

/**
 * Create a write buffer for events
 */
export function createEventWriteBuffer<T>(
  onFlush: (items: T[]) => Promise<void>
): WriteBuffer<T> {
  return new WriteBuffer({
    maxSize: 100,
    flushIntervalMs: 100,
    onFlush,
    retry: {
      maxAttempts: 3,
      delayMs: 50,
    },
  })
}

// ============================================================================
// Batched Writer Utility
// ============================================================================

/**
 * Create a batched writer that wraps any insert function
 */
export function createBatchedWriter<T, R>(
  insertFn: (items: T[]) => Promise<R>,
  config?: Partial<WriteBufferConfig<T>>
): {
  write: (item: T) => void
  writeBatch: (items: T[]) => void
  flush: () => Promise<void>
  dispose: () => Promise<void>
  getStats: () => WriteBufferStats
} {
  const buffer = new WriteBuffer<T>({
    maxSize: config?.maxSize ?? 100,
    flushIntervalMs: config?.flushIntervalMs ?? 500,
    onFlush: async (items) => {
      await insertFn(items)
    },
    onError: config?.onError,
    retry: config?.retry,
  })

  return {
    write: (item: T) => buffer.add(item),
    writeBatch: (items: T[]) => buffer.addBatch(items),
    flush: () => buffer.flush(),
    dispose: () => buffer.dispose(),
    getStats: () => buffer.getStats(),
  }
}
