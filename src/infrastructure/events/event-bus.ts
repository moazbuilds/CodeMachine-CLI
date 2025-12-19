/**
 * Async Event Bus with Backpressure
 *
 * Features:
 * - Async queue per subscriber (prevents blocking)
 * - Configurable buffer sizes
 * - Priority lanes (high, normal, low)
 * - Graceful drain for shutdown
 * - Metrics for monitoring
 */

import type { Unsubscribe } from '../../shared/types'
import type { AllDomainEvents, DomainEvent } from './event-types'

// ============================================================================
// Types
// ============================================================================

export type EventPriority = 'high' | 'normal' | 'low'

export interface SubscriptionOptions {
  /** Maximum concurrent handler executions (default: 1) */
  maxConcurrent?: number
  /** Queue size before oldest events are dropped (default: 1000) */
  bufferSize?: number
  /** Event priority lane (default: 'normal') */
  priority?: EventPriority
  /** Whether to catch handler errors (default: true) */
  catchErrors?: boolean
}

export interface EventBusMetrics {
  totalEmitted: number
  totalDelivered: number
  totalDropped: number
  subscriberCount: number
  queueDepths: Map<string, number>
}

type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>

// ============================================================================
// Subscriber Queue (Internal)
// ============================================================================

interface QueuedEvent {
  event: DomainEvent
  priority: EventPriority
}

class SubscriberQueue {
  private queue: QueuedEvent[] = []
  private processing = 0
  private readonly maxConcurrent: number
  private readonly bufferSize: number
  private readonly handler: EventHandler
  private readonly catchErrors: boolean
  private readonly onDrop?: (event: DomainEvent) => void

  private drainPromise: Promise<void> | null = null
  private drainResolve: (() => void) | null = null

  constructor(
    handler: EventHandler,
    options: Required<SubscriptionOptions>,
    onDrop?: (event: DomainEvent) => void
  ) {
    this.handler = handler
    this.maxConcurrent = options.maxConcurrent
    this.bufferSize = options.bufferSize
    this.catchErrors = options.catchErrors
    this.onDrop = onDrop
  }

  enqueue(event: DomainEvent, priority: EventPriority): boolean {
    // Check buffer overflow
    if (this.queue.length >= this.bufferSize) {
      // Drop oldest event (FIFO overflow)
      const dropped = this.queue.shift()
      if (dropped && this.onDrop) {
        this.onDrop(dropped.event)
      }
    }

    // Insert based on priority
    const queuedEvent: QueuedEvent = { event, priority }

    if (priority === 'high') {
      // High priority goes to front (after other high priority)
      const insertIndex = this.queue.findIndex(e => e.priority !== 'high')
      if (insertIndex === -1) {
        this.queue.push(queuedEvent)
      } else {
        this.queue.splice(insertIndex, 0, queuedEvent)
      }
    } else if (priority === 'low') {
      // Low priority goes to end
      this.queue.push(queuedEvent)
    } else {
      // Normal priority goes after high, before low
      const insertIndex = this.queue.findIndex(e => e.priority === 'low')
      if (insertIndex === -1) {
        this.queue.push(queuedEvent)
      } else {
        this.queue.splice(insertIndex, 0, queuedEvent)
      }
    }

    // Trigger processing
    this.processNext()

    return true
  }

  private async processNext(): Promise<void> {
    // Check if we can process more
    if (this.processing >= this.maxConcurrent) {
      return
    }

    // Get next event
    const queued = this.queue.shift()
    if (!queued) {
      // Queue empty, check if draining
      if (this.drainResolve && this.processing === 0) {
        this.drainResolve()
        this.drainPromise = null
        this.drainResolve = null
      }
      return
    }

    this.processing++

    try {
      const result = this.handler(queued.event)
      if (result instanceof Promise) {
        await result
      }
    } catch (error) {
      if (!this.catchErrors) {
        throw error
      }
      // Log error but continue processing
      console.error('[EventBus] Handler error:', error)
    } finally {
      this.processing--
      // Process next in queue
      this.processNext()
    }
  }

  get depth(): number {
    return this.queue.length + this.processing
  }

  async drain(): Promise<void> {
    if (this.queue.length === 0 && this.processing === 0) {
      return
    }

    if (!this.drainPromise) {
      this.drainPromise = new Promise(resolve => {
        this.drainResolve = resolve
      })
    }

    return this.drainPromise
  }
}

// ============================================================================
// Event Bus Implementation
// ============================================================================

export interface IEventBus {
  emit<T extends DomainEvent>(event: T): void
  subscribe<T extends DomainEvent>(
    type: T['type'],
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Unsubscribe
  subscribeAll(handler: EventHandler, options?: SubscriptionOptions): Unsubscribe
  once<T extends DomainEvent>(type: T['type'], handler: EventHandler<T>): Unsubscribe
  drain(): Promise<void>
  getMetrics(): EventBusMetrics
  clear(): void
}

interface Subscriber {
  id: string
  type: string | '*'
  queue: SubscriberQueue
  priority: EventPriority
}

export class AsyncEventBus implements IEventBus {
  private subscribers = new Map<string, Subscriber>()
  private subscribersByType = new Map<string, Set<string>>()
  private nextId = 0

  private metrics = {
    totalEmitted: 0,
    totalDelivered: 0,
    totalDropped: 0,
  }

  private readonly defaultOptions: Required<SubscriptionOptions> = {
    maxConcurrent: 1,
    bufferSize: 1000,
    priority: 'normal',
    catchErrors: true,
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T extends DomainEvent>(event: T): void {
    this.metrics.totalEmitted++

    // Get subscribers for this event type
    const typeSubscribers = this.subscribersByType.get(event.type) ?? new Set()
    const allSubscribers = this.subscribersByType.get('*') ?? new Set()

    const subscriberIds = new Set([...typeSubscribers, ...allSubscribers])

    for (const id of subscriberIds) {
      const subscriber = this.subscribers.get(id)
      if (subscriber) {
        const delivered = subscriber.queue.enqueue(event, subscriber.priority)
        if (delivered) {
          this.metrics.totalDelivered++
        }
      }
    }
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T extends DomainEvent>(
    type: T['type'],
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Unsubscribe {
    const id = `sub_${this.nextId++}`
    const mergedOptions = { ...this.defaultOptions, ...options }

    const queue = new SubscriberQueue(
      handler as EventHandler,
      mergedOptions,
      () => this.metrics.totalDropped++
    )

    const subscriber: Subscriber = {
      id,
      type,
      queue,
      priority: mergedOptions.priority,
    }

    this.subscribers.set(id, subscriber)

    // Index by type
    if (!this.subscribersByType.has(type)) {
      this.subscribersByType.set(type, new Set())
    }
    this.subscribersByType.get(type)!.add(id)

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(id)
      this.subscribersByType.get(type)?.delete(id)
    }
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler, options?: SubscriptionOptions): Unsubscribe {
    return this.subscribe('*' as AllDomainEvents['type'], handler, options)
  }

  /**
   * Subscribe to a single occurrence of an event
   */
  once<T extends DomainEvent>(type: T['type'], handler: EventHandler<T>): Unsubscribe {
    const unsubscribe = this.subscribe<T>(type, async (event) => {
      unsubscribe()
      await handler(event)
    })
    return unsubscribe
  }

  /**
   * Wait for all queued events to be processed
   */
  async drain(): Promise<void> {
    const drainPromises = Array.from(this.subscribers.values()).map(sub => sub.queue.drain())
    await Promise.all(drainPromises)
  }

  /**
   * Get current metrics
   */
  getMetrics(): EventBusMetrics {
    const queueDepths = new Map<string, number>()
    for (const [id, subscriber] of this.subscribers) {
      queueDepths.set(id, subscriber.queue.depth)
    }

    return {
      totalEmitted: this.metrics.totalEmitted,
      totalDelivered: this.metrics.totalDelivered,
      totalDropped: this.metrics.totalDropped,
      subscriberCount: this.subscribers.size,
      queueDepths,
    }
  }

  /**
   * Clear all subscribers
   */
  clear(): void {
    this.subscribers.clear()
    this.subscribersByType.clear()
    this.nextId = 0
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalEventBus: AsyncEventBus | null = null

export const getEventBus = (): AsyncEventBus => {
  if (!globalEventBus) {
    globalEventBus = new AsyncEventBus()
  }
  return globalEventBus
}

export const resetEventBus = (): void => {
  globalEventBus?.clear()
  globalEventBus = null
}

// ============================================================================
// Utility: Event Batching
// ============================================================================

export interface BatchedEventEmitter {
  queue<T extends DomainEvent>(event: T): void
  flush(): void
}

export const createBatchedEmitter = (
  eventBus: IEventBus,
  intervalMs = 16
): BatchedEventEmitter => {
  let batch: DomainEvent[] = []
  let timer: NodeJS.Timeout | null = null

  const flush = (): void => {
    if (batch.length > 0) {
      for (const event of batch) {
        eventBus.emit(event)
      }
      batch = []
    }
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const queue = <T extends DomainEvent>(event: T): void => {
    batch.push(event)

    if (!timer) {
      timer = setTimeout(flush, intervalMs)
    }
  }

  return { queue, flush }
}

// ============================================================================
// Utility: Typed Event Helpers
// ============================================================================

export const on = <T extends AllDomainEvents>(
  eventBus: IEventBus,
  type: T['type'],
  handler: EventHandler<T>,
  options?: SubscriptionOptions
): Unsubscribe => {
  return eventBus.subscribe(type, handler, options)
}

export const once = <T extends AllDomainEvents>(
  eventBus: IEventBus,
  type: T['type']
): Promise<T> => {
  return new Promise(resolve => {
    eventBus.once<T>(type, resolve)
  })
}
