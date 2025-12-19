/**
 * Persistent Event Bus
 *
 * Wraps the AsyncEventBus to persist all events to SQLite for:
 * - Audit trail
 * - Event replay
 * - Debugging
 * - Analytics
 */

import type { Unsubscribe } from '../../shared/types/index.js'
import type { DomainEvent } from './event-types.js'
import {
  AsyncEventBus,
  type IEventBus,
  type SubscriptionOptions,
  type EventBusMetrics,
} from './event-bus.js'
import { SQLiteEventStore, type IEventStore } from './event-store.js'

type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>

/**
 * Persistent event bus configuration
 */
export interface PersistentEventBusConfig {
  /** Enable persistence (default: true) */
  enabled?: boolean
  /** Persist events asynchronously without blocking emit (default: true) */
  async?: boolean
  /** Event types to exclude from persistence */
  excludeTypes?: string[]
  /** Batch persistence for better performance */
  batchSize?: number
  /** Batch flush interval in ms */
  batchIntervalMs?: number
}

const DEFAULT_CONFIG: Required<PersistentEventBusConfig> = {
  enabled: true,
  async: true,
  excludeTypes: [],
  batchSize: 100,
  batchIntervalMs: 100,
}

/**
 * Persistent Event Bus
 *
 * Decorates the AsyncEventBus to persist events to SQLite.
 */
export class PersistentEventBus implements IEventBus {
  private config: Required<PersistentEventBusConfig>
  private eventStore: IEventStore
  private batch: DomainEvent[] = []
  private batchTimer: NodeJS.Timeout | null = null

  constructor(
    private inner: AsyncEventBus,
    eventStore?: IEventStore,
    config?: PersistentEventBusConfig
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.eventStore = eventStore ?? new SQLiteEventStore()
  }

  /**
   * Emit an event (persists + dispatches)
   */
  emit<T extends DomainEvent>(event: T): void {
    // Persist event (if enabled and not excluded)
    if (this.config.enabled && !this.isExcluded(event)) {
      if (this.config.async) {
        this.persistAsync(event)
      } else {
        // Fire-and-forget for sync mode
        this.eventStore.append(event).catch((err) => {
          console.error('[PersistentEventBus] Failed to persist event:', err)
        })
      }
    }

    // Dispatch to subscribers
    this.inner.emit(event)
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T extends DomainEvent>(
    type: T['type'],
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Unsubscribe {
    return this.inner.subscribe(type, handler, options)
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler, options?: SubscriptionOptions): Unsubscribe {
    return this.inner.subscribeAll(handler, options)
  }

  /**
   * Subscribe to a single occurrence of an event
   */
  once<T extends DomainEvent>(type: T['type'], handler: EventHandler<T>): Unsubscribe {
    return this.inner.once(type, handler)
  }

  /**
   * Wait for all queued events to be processed
   */
  async drain(): Promise<void> {
    // Flush any pending batch
    await this.flushBatch()
    // Drain inner bus
    await this.inner.drain()
  }

  /**
   * Get current metrics
   */
  getMetrics(): EventBusMetrics {
    return this.inner.getMetrics()
  }

  /**
   * Clear all subscribers
   */
  clear(): void {
    this.inner.clear()
    // Clear batch
    this.batch = []
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }

  /**
   * Get the event store
   */
  getEventStore(): IEventStore {
    return this.eventStore
  }

  /**
   * Persist event asynchronously with batching
   */
  private persistAsync(event: DomainEvent): void {
    this.batch.push(event)

    // Flush immediately if batch is full
    if (this.batch.length >= this.config.batchSize) {
      this.flushBatch().catch((err) => {
        console.error('[PersistentEventBus] Failed to flush batch:', err)
      })
    } else if (!this.batchTimer) {
      // Schedule flush
      this.batchTimer = setTimeout(() => {
        this.flushBatch().catch((err) => {
          console.error('[PersistentEventBus] Failed to flush batch:', err)
        })
      }, this.config.batchIntervalMs)
    }
  }

  /**
   * Flush the current batch to the event store
   */
  private async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    if (this.batch.length === 0) return

    const eventsToFlush = this.batch
    this.batch = []

    try {
      await this.eventStore.appendBatch(eventsToFlush)
    } catch (error) {
      console.error('[PersistentEventBus] Failed to persist batch:', error)
      // Events are lost - could implement retry logic here
    }
  }

  /**
   * Check if event type is excluded from persistence
   */
  private isExcluded(event: DomainEvent): boolean {
    return this.config.excludeTypes.includes(event.type)
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a persistent event bus
 */
export function createPersistentEventBus(
  config?: PersistentEventBusConfig
): PersistentEventBus {
  const inner = new AsyncEventBus()
  return new PersistentEventBus(inner, undefined, config)
}

/**
 * Wrap an existing event bus with persistence
 */
export function withPersistence(
  eventBus: AsyncEventBus,
  config?: PersistentEventBusConfig
): PersistentEventBus {
  return new PersistentEventBus(eventBus, undefined, config)
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalPersistentEventBus: PersistentEventBus | null = null

/**
 * Get the global persistent event bus
 */
export function getPersistentEventBus(
  config?: PersistentEventBusConfig
): PersistentEventBus {
  if (!globalPersistentEventBus) {
    globalPersistentEventBus = createPersistentEventBus(config)
  }
  return globalPersistentEventBus
}

/**
 * Reset the global persistent event bus
 */
export function resetPersistentEventBus(): void {
  globalPersistentEventBus?.clear()
  globalPersistentEventBus = null
}
