/**
 * Event Repository
 *
 * Type-safe repository for event sourcing operations using Drizzle ORM.
 */

import { eq, and, desc, asc, sql, gte, lte, inArray } from 'drizzle-orm'
import type { DrizzleDB } from '../connection.js'
import {
  events,
  type Event,
  type NewEvent,
  type EventQueryOptions,
  type EventStoreStats,
} from '../schema/index.js'

export class EventRepository {
  constructor(private db: DrizzleDB) {}

  /**
   * Append a single event
   */
  async append(event: NewEvent): Promise<number> {
    const [result] = await this.db.insert(events).values(event).returning({ id: events.id })
    return result.id
  }

  /**
   * Append multiple events in a batch
   */
  async appendBatch(eventList: NewEvent[]): Promise<number[]> {
    if (eventList.length === 0) return []

    const results = await this.db.insert(events).values(eventList).returning({ id: events.id })
    return results.map((r) => r.id)
  }

  /**
   * Get event by ID
   */
  async get(id: number): Promise<Event | null> {
    const result = await this.db.query.events.findFirst({
      where: eq(events.id, id),
    })
    return result ?? null
  }

  /**
   * Query events with filters
   */
  async query(options: EventQueryOptions = {}): Promise<Event[]> {
    const conditions = []

    // Type filter
    if (options.type) {
      if (Array.isArray(options.type)) {
        conditions.push(inArray(events.type, options.type))
      } else {
        conditions.push(eq(events.type, options.type))
      }
    }

    // Correlation ID filter
    if (options.correlationId) {
      conditions.push(eq(events.correlationId, options.correlationId))
    }

    // Aggregate filter
    if (options.aggregateId) {
      conditions.push(eq(events.aggregateId, options.aggregateId))
    }
    if (options.aggregateType) {
      conditions.push(eq(events.aggregateType, options.aggregateType))
    }

    // Time range filter
    if (options.from !== undefined) {
      conditions.push(gte(events.timestamp, options.from))
    }
    if (options.to !== undefined) {
      conditions.push(lte(events.timestamp, options.to))
    }

    const query = this.db
      .select()
      .from(events)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(options.order === 'desc' ? desc(events.timestamp) : asc(events.timestamp))

    if (options.limit) {
      query.limit(options.limit)
    }
    if (options.offset) {
      query.offset(options.offset)
    }

    return query
  }

  /**
   * Get events by aggregate
   */
  async getByAggregate(aggregateType: string, aggregateId: string): Promise<Event[]> {
    return this.query({
      aggregateType,
      aggregateId,
      order: 'asc',
    })
  }

  /**
   * Get events by correlation ID
   */
  async getByCorrelation(correlationId: string): Promise<Event[]> {
    return this.query({
      correlationId,
      order: 'asc',
    })
  }

  /**
   * Get events by type
   */
  async getByType(type: string | string[], options?: Omit<EventQueryOptions, 'type'>): Promise<Event[]> {
    return this.query({
      ...options,
      type,
    })
  }

  /**
   * Get recent events
   */
  async getRecent(limit: number = 100): Promise<Event[]> {
    return this.query({
      limit,
      order: 'desc',
    })
  }

  /**
   * Replay events from a given ID
   */
  async *replay(
    fromId: number = 0,
    options?: { batchSize?: number; type?: string | string[] }
  ): AsyncGenerator<Event[], void, unknown> {
    const batchSize = options?.batchSize ?? 100
    let lastId = fromId

    while (true) {
      const conditions = [gte(events.id, lastId)]

      if (options?.type) {
        if (Array.isArray(options.type)) {
          conditions.push(inArray(events.type, options.type))
        } else {
          conditions.push(eq(events.type, options.type))
        }
      }

      const batch = await this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(asc(events.id))
        .limit(batchSize)

      if (batch.length === 0) break

      yield batch

      lastId = batch[batch.length - 1].id + 1
    }
  }

  /**
   * Get event count by type
   */
  async countByType(): Promise<Record<string, number>> {
    const results = await this.db
      .select({
        type: events.type,
        count: sql<number>`COUNT(*)`,
      })
      .from(events)
      .groupBy(events.type)

    return results.reduce(
      (acc, row) => {
        acc[row.type] = row.count
        return acc
      },
      {} as Record<string, number>
    )
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<EventStoreStats> {
    const [countResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(events)

    const [rangeResult] = await this.db
      .select({
        oldest: sql<number | null>`MIN(${events.timestamp})`,
        newest: sql<number | null>`MAX(${events.timestamp})`,
      })
      .from(events)

    const eventsByType = await this.countByType()

    return {
      totalEvents: countResult.count,
      eventsByType,
      oldestEvent: rangeResult.oldest,
      newestEvent: rangeResult.newest,
    }
  }

  /**
   * Delete events older than a timestamp
   */
  async deleteOlderThan(timestamp: number): Promise<number> {
    const result = await this.db
      .delete(events)
      .where(lte(events.timestamp, timestamp))
      .returning({ id: events.id })

    return result.length
  }

  /**
   * Delete events by type
   */
  async deleteByType(type: string): Promise<number> {
    const result = await this.db
      .delete(events)
      .where(eq(events.type, type))
      .returning({ id: events.id })

    return result.length
  }

  /**
   * Get the last event ID
   */
  async getLastId(): Promise<number> {
    const [result] = await this.db
      .select({ maxId: sql<number>`MAX(${events.id})` })
      .from(events)

    return result?.maxId ?? 0
  }
}
