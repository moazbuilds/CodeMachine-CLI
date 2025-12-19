/**
 * Indexed Logger
 *
 * Enhanced logger that writes logs to both file and SQLite for searchability.
 * Uses batching for optimal write performance.
 */

import { getDatabase, type DrizzleDB } from '../database/connection.js'
import { LogRepository } from '../database/repositories/log.repository.js'
import type { NewLog, LogLevel, LogSearchParams, LogSearchResult, LogLevelCounts } from '../database/schema/logs.js'

/**
 * Logger configuration
 */
export interface IndexedLoggerConfig {
  /** Enable SQLite indexing (default: true) */
  enabled?: boolean
  /** Agent ID to associate logs with */
  agentId?: number
  /** Default source for logs */
  source?: string
  /** Correlation ID for tracing */
  correlationId?: string
  /** Batch size before flushing (default: 50) */
  batchSize?: number
  /** Batch flush interval in ms (default: 500) */
  batchIntervalMs?: number
  /** Minimum log level to index (default: 'debug') */
  minLevel?: LogLevel
}

const DEFAULT_CONFIG: Required<Omit<IndexedLoggerConfig, 'agentId' | 'source' | 'correlationId'>> = {
  enabled: true,
  batchSize: 50,
  batchIntervalMs: 500,
  minLevel: 'debug',
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Indexed Logger
 *
 * Writes logs to SQLite with batching for performance.
 */
export class IndexedLogger {
  private config: Required<Omit<IndexedLoggerConfig, 'agentId' | 'source' | 'correlationId'>>
  private agentId?: number
  private source?: string
  private correlationId?: string
  private repository: LogRepository
  private batch: NewLog[] = []
  private batchTimer: NodeJS.Timeout | null = null

  constructor(db?: DrizzleDB, config?: IndexedLoggerConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      enabled: config?.enabled ?? DEFAULT_CONFIG.enabled,
      batchSize: config?.batchSize ?? DEFAULT_CONFIG.batchSize,
      batchIntervalMs: config?.batchIntervalMs ?? DEFAULT_CONFIG.batchIntervalMs,
      minLevel: config?.minLevel ?? DEFAULT_CONFIG.minLevel,
    }
    this.agentId = config?.agentId
    this.source = config?.source
    this.correlationId = config?.correlationId
    this.repository = new LogRepository(db ?? getDatabase())
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context)
  }

  /**
   * Log a message with a specific level
   */
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    // Check if level meets minimum threshold
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) {
      return
    }

    // Skip if indexing is disabled
    if (!this.config.enabled) {
      return
    }

    const entry: NewLog = {
      level,
      message,
      timestamp: Date.now(),
      agentId: this.agentId ?? null,
      source: this.source ?? null,
      correlationId: this.correlationId ?? null,
      context: context ? (context as Record<string, unknown>) : null,
    }

    this.batch.push(entry)

    // Flush immediately if batch is full
    if (this.batch.length >= this.config.batchSize) {
      this.flush().catch((err) => {
        console.error('[IndexedLogger] Failed to flush batch:', err)
      })
    } else if (!this.batchTimer) {
      // Schedule flush
      this.batchTimer = setTimeout(() => {
        this.flush().catch((err) => {
          console.error('[IndexedLogger] Failed to flush batch:', err)
        })
      }, this.config.batchIntervalMs)
    }
  }

  /**
   * Flush pending logs to SQLite
   */
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    if (this.batch.length === 0) return

    const entriesToFlush = this.batch
    this.batch = []

    try {
      await this.repository.insertBatch(entriesToFlush)
    } catch (error) {
      console.error('[IndexedLogger] Failed to persist logs:', error)
    }
  }

  /**
   * Create a child logger with inherited context
   */
  child(config: Partial<IndexedLoggerConfig>): IndexedLogger {
    return new IndexedLogger(undefined, {
      enabled: this.config.enabled,
      batchSize: this.config.batchSize,
      batchIntervalMs: this.config.batchIntervalMs,
      minLevel: this.config.minLevel,
      agentId: config.agentId ?? this.agentId,
      source: config.source ?? this.source,
      correlationId: config.correlationId ?? this.correlationId,
    })
  }

  /**
   * Set the agent ID for subsequent logs
   */
  setAgentId(agentId: number): void {
    this.agentId = agentId
  }

  /**
   * Set the correlation ID for tracing
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId
  }

  /**
   * Search logs
   */
  async search(params: LogSearchParams): Promise<LogSearchResult[]> {
    // Flush pending logs first to ensure they're searchable
    await this.flush()
    return this.repository.search(params)
  }

  /**
   * Get recent logs
   */
  async getRecent(limit?: number): Promise<LogSearchResult[]> {
    await this.flush()
    return this.repository.getRecent(limit)
  }

  /**
   * Get error logs
   */
  async getErrors(options?: { agentId?: number; from?: number; limit?: number }): Promise<LogSearchResult[]> {
    await this.flush()
    return this.repository.getErrors(options)
  }

  /**
   * Count logs by level
   */
  async countByLevel(agentId?: number): Promise<LogLevelCounts> {
    await this.flush()
    return this.repository.countByLevel(agentId)
  }

  /**
   * Close the logger (flushes pending logs)
   */
  async close(): Promise<void> {
    await this.flush()
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalIndexedLogger: IndexedLogger | null = null

/**
 * Get the global indexed logger
 */
export function getIndexedLogger(config?: IndexedLoggerConfig): IndexedLogger {
  if (!globalIndexedLogger) {
    globalIndexedLogger = new IndexedLogger(undefined, config)
  }
  return globalIndexedLogger
}

/**
 * Reset the global indexed logger
 */
export function resetIndexedLogger(): void {
  if (globalIndexedLogger) {
    globalIndexedLogger.flush().catch(() => {})
    globalIndexedLogger = null
  }
}

// ============================================================================
// Log Search Query Service
// ============================================================================

/**
 * Log search service for querying indexed logs
 */
export class LogSearchService {
  private repository: LogRepository

  constructor(db?: DrizzleDB) {
    this.repository = new LogRepository(db ?? getDatabase())
  }

  /**
   * Full-text search on logs
   */
  async search(query: string, options?: Omit<LogSearchParams, 'query'>): Promise<LogSearchResult[]> {
    return this.repository.search({ query, ...options })
  }

  /**
   * Get logs by agent
   */
  async getByAgent(agentId: number, options?: { limit?: number; from?: number; to?: number }): Promise<LogSearchResult[]> {
    return this.repository.search({ agentId, ...options, order: 'desc' })
  }

  /**
   * Get logs by time range
   */
  async getByTimeRange(from: number, to: number, options?: { level?: LogLevel | LogLevel[]; limit?: number }): Promise<LogSearchResult[]> {
    return this.repository.search({ from, to, ...options, order: 'desc' })
  }

  /**
   * Get errors in time range
   */
  async getErrorsInRange(from: number, to: number, limit?: number): Promise<LogSearchResult[]> {
    return this.repository.search({ from, to, level: 'error', limit, order: 'desc' })
  }

  /**
   * Get log statistics
   */
  async getStats(agentId?: number): Promise<LogLevelCounts> {
    return this.repository.countByLevel(agentId)
  }

  /**
   * Cleanup old logs
   */
  async cleanup(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs
    return this.repository.deleteOlderThan(cutoff)
  }
}
