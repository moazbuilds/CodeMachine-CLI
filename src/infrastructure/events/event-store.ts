/**
 * Event Store
 *
 * SQLite-backed event store for event sourcing.
 * Provides durable storage, replay, and querying of domain events.
 */

import { getDatabase, type DrizzleDB } from '../database/connection.js'
import { EventRepository } from '../database/repositories/event.repository.js'
import type {
  NewEvent,
  Event,
  EventQueryOptions,
  EventStoreStats,
} from '../database/schema/events.js'
import type { DomainEvent } from './event-types.js'

/**
 * Event store interface
 */
export interface IEventStore {
  /** Append a single event */
  append(event: DomainEvent): Promise<number>
  /** Append multiple events in a batch */
  appendBatch(events: DomainEvent[]): Promise<number[]>
  /** Get events by aggregate (e.g., workflow, agent) */
  getByAggregate(aggregateType: string, aggregateId: string): Promise<StoredEvent[]>
  /** Get events by correlation ID */
  getByCorrelation(correlationId: string): Promise<StoredEvent[]>
  /** Get events by type */
  getByType(type: string | string[], options?: Omit<EventQueryOptions, 'type'>): Promise<StoredEvent[]>
  /** Query events with filters */
  query(options: EventQueryOptions): Promise<StoredEvent[]>
  /** Replay events from a starting point */
  replay(handler: EventReplayHandler, options?: ReplayOptions): Promise<void>
  /** Get store statistics */
  getStats(): Promise<EventStoreStats>
  /** Delete old events (for cleanup) */
  deleteOlderThan(timestamp: number): Promise<number>
}

/**
 * Stored event (event with database metadata)
 */
export interface StoredEvent extends DomainEvent {
  /** Database ID */
  id: number
  /** Storage version */
  version: number
  /** When stored in database */
  createdAt: number
}

/**
 * Event replay handler
 */
export type EventReplayHandler = (event: StoredEvent) => void | Promise<void>

/**
 * Replay options
 */
export interface ReplayOptions {
  /** Start from this event ID (exclusive) */
  fromId?: number
  /** Start from this timestamp */
  fromTimestamp?: number
  /** Filter by event types */
  types?: string[]
  /** Filter by aggregate */
  aggregateType?: string
  aggregateId?: string
  /** Batch size for processing */
  batchSize?: number
}

/**
 * SQLite Event Store implementation
 */
export class SQLiteEventStore implements IEventStore {
  private repository: EventRepository

  constructor(db?: DrizzleDB) {
    this.repository = new EventRepository(db ?? getDatabase())
  }

  /**
   * Append a single event
   */
  async append(event: DomainEvent): Promise<number> {
    const newEvent = this.toNewEvent(event)
    return this.repository.append(newEvent)
  }

  /**
   * Append multiple events in a batch
   */
  async appendBatch(events: DomainEvent[]): Promise<number[]> {
    const newEvents = events.map(e => this.toNewEvent(e))
    return this.repository.appendBatch(newEvents)
  }

  /**
   * Get events by aggregate
   */
  async getByAggregate(aggregateType: string, aggregateId: string): Promise<StoredEvent[]> {
    const events = await this.repository.getByAggregate(aggregateType, aggregateId)
    return events.map(e => this.toStoredEvent(e))
  }

  /**
   * Get events by correlation ID
   */
  async getByCorrelation(correlationId: string): Promise<StoredEvent[]> {
    const events = await this.repository.getByCorrelation(correlationId)
    return events.map(e => this.toStoredEvent(e))
  }

  /**
   * Get events by type
   */
  async getByType(
    type: string | string[],
    options?: Omit<EventQueryOptions, 'type'>
  ): Promise<StoredEvent[]> {
    const events = await this.repository.getByType(type, options)
    return events.map(e => this.toStoredEvent(e))
  }

  /**
   * Query events with filters
   */
  async query(options: EventQueryOptions): Promise<StoredEvent[]> {
    const events = await this.repository.query(options)
    return events.map(e => this.toStoredEvent(e))
  }

  /**
   * Replay events
   */
  async replay(handler: EventReplayHandler, options: ReplayOptions = {}): Promise<void> {
    const startId = options.fromId ?? 0

    for await (const batch of this.repository.replay(startId, {
      batchSize: options.batchSize,
      type: options.types,
    })) {
      for (const event of batch) {
        // Apply additional filters
        if (options.fromTimestamp && event.timestamp < options.fromTimestamp) {
          continue
        }
        if (options.aggregateType && event.aggregateType !== options.aggregateType) {
          continue
        }
        if (options.aggregateId && event.aggregateId !== options.aggregateId) {
          continue
        }

        const storedEvent = this.toStoredEvent(event)
        await handler(storedEvent)
      }
    }
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<EventStoreStats> {
    return this.repository.getStats()
  }

  /**
   * Delete events older than a timestamp
   */
  async deleteOlderThan(timestamp: number): Promise<number> {
    return this.repository.deleteOlderThan(timestamp)
  }

  /**
   * Get the last event ID
   */
  async getLastId(): Promise<number> {
    return this.repository.getLastId()
  }

  /**
   * Convert domain event to database event
   */
  private toNewEvent(event: DomainEvent): NewEvent {
    return {
      type: event.type,
      timestamp: event.timestamp,
      correlationId: event.correlationId ?? null,
      causationId: event.causationId ?? null,
      aggregateId: this.extractAggregateId(event),
      aggregateType: this.extractAggregateType(event),
      payload: event as unknown as Record<string, unknown>,
      version: 1,
    }
  }

  /**
   * Convert database event to stored event
   */
  private toStoredEvent(event: Event): StoredEvent {
    const payload = event.payload as unknown as DomainEvent
    return {
      ...payload,
      id: event.id,
      version: event.version,
      createdAt: event.createdAt ?? Date.now(),
    }
  }

  /**
   * Extract aggregate ID from event
   */
  private extractAggregateId(event: DomainEvent): string | null {
    // Check for common aggregate ID patterns
    if ('workflowId' in event && typeof event.workflowId === 'string') {
      return event.workflowId
    }
    if ('agentId' in event && typeof event.agentId === 'number') {
      return String(event.agentId)
    }
    if ('stepIndex' in event && typeof event.stepIndex === 'number') {
      return String(event.stepIndex)
    }
    return null
  }

  /**
   * Extract aggregate type from event
   */
  private extractAggregateType(event: DomainEvent): string | null {
    const type = event.type

    if (type.startsWith('WORKFLOW_') || type.includes('WORKFLOW')) {
      return 'workflow'
    }
    if (type.startsWith('STEP_') || type.includes('STEP')) {
      return 'step'
    }
    if (type.startsWith('AGENT_') || type.includes('AGENT')) {
      return 'agent'
    }
    if (type.startsWith('SUBAGENT_') || type.includes('SUBAGENT')) {
      return 'subagent'
    }
    if (type.startsWith('INPUT_') || type.includes('INPUT') || type.includes('MODE')) {
      return 'input'
    }

    return null
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalEventStore: SQLiteEventStore | null = null

/**
 * Get the global event store instance
 */
export function getEventStore(): SQLiteEventStore {
  if (!globalEventStore) {
    globalEventStore = new SQLiteEventStore()
  }
  return globalEventStore
}

/**
 * Reset the global event store
 */
export function resetEventStore(): void {
  globalEventStore = null
}
