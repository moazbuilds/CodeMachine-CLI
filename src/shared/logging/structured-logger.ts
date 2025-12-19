/**
 * Enhanced Structured Logging Infrastructure
 *
 * Provides consistent, structured logging across the application.
 *
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Structured context data
 * - Multiple transports (console, file)
 * - Correlation IDs for tracing
 * - Performance-friendly (lazy evaluation)
 * - Child loggers with inherited context
 */

import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  readonly level: LogLevel
  readonly message: string
  readonly timestamp: number
  readonly context?: Record<string, unknown>
  readonly correlationId?: string
  readonly source?: string
  readonly error?: {
    name: string
    message: string
    stack?: string
  }
}

export interface StructuredLoggerConfig {
  /** Minimum log level to output */
  level: LogLevel
  /** Logger name/source */
  name?: string
  /** Enable console output */
  console?: boolean
  /** File path for file output */
  filePath?: string
  /** Include timestamps in console */
  timestamps?: boolean
  /** Pretty print JSON in console */
  pretty?: boolean
  /** Correlation ID for request tracing */
  correlationId?: string
}

export interface IStructuredLogger {
  debug(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, error?: Error, context?: Record<string, unknown>): void
  child(context: Record<string, unknown>): IStructuredLogger
  withCorrelationId(id: string): IStructuredLogger
}

// ============================================================================
// Log Level Utilities
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const shouldLog = (configLevel: LogLevel, messageLevel: LogLevel): boolean => {
  return LOG_LEVELS[messageLevel] >= LOG_LEVELS[configLevel]
}

// ============================================================================
// Console Formatting
// ============================================================================

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m',  // cyan
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
}

const RESET = '\x1b[0m'

const formatConsoleMessage = (entry: LogEntry, config: StructuredLoggerConfig): string => {
  const parts: string[] = []

  // Timestamp
  if (config.timestamps !== false) {
    const date = new Date(entry.timestamp)
    parts.push(`\x1b[90m${date.toISOString()}\x1b[0m`)
  }

  // Level
  const levelColor = LEVEL_COLORS[entry.level]
  parts.push(`${levelColor}${entry.level.toUpperCase().padEnd(5)}${RESET}`)

  // Source
  if (entry.source) {
    parts.push(`\x1b[35m[${entry.source}]${RESET}`)
  }

  // Correlation ID
  if (entry.correlationId) {
    parts.push(`\x1b[90m(${entry.correlationId.slice(0, 8)})${RESET}`)
  }

  // Message
  parts.push(entry.message)

  // Context
  if (entry.context && Object.keys(entry.context).length > 0) {
    if (config.pretty) {
      parts.push('\n' + JSON.stringify(entry.context, null, 2))
    } else {
      parts.push(JSON.stringify(entry.context))
    }
  }

  // Error
  if (entry.error) {
    parts.push(`\n${LEVEL_COLORS.error}${entry.error.name}: ${entry.error.message}${RESET}`)
    if (entry.error.stack) {
      parts.push(`\n${entry.error.stack}`)
    }
  }

  return parts.join(' ')
}

// ============================================================================
// File Transport
// ============================================================================

class FileTransport {
  private writeStream: fs.WriteStream | null = null
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
    this.ensureDirectory()
  }

  write(entry: LogEntry): void {
    if (!this.writeStream) {
      this.writeStream = fs.createWriteStream(this.filePath, { flags: 'a' })
    }

    const line = JSON.stringify(entry) + '\n'
    this.writeStream.write(line)
  }

  close(): void {
    if (this.writeStream) {
      this.writeStream.end()
      this.writeStream = null
    }
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

// ============================================================================
// Logger Implementation
// ============================================================================

export class StructuredLogger implements IStructuredLogger {
  private readonly config: Required<StructuredLoggerConfig>
  private readonly baseContext: Record<string, unknown>
  private fileTransport: FileTransport | null = null

  constructor(config: StructuredLoggerConfig, baseContext: Record<string, unknown> = {}) {
    this.config = {
      level: config.level,
      name: config.name ?? 'app',
      console: config.console ?? true,
      filePath: config.filePath ?? '',
      timestamps: config.timestamps ?? true,
      pretty: config.pretty ?? false,
      correlationId: config.correlationId ?? '',
    }
    this.baseContext = baseContext

    if (this.config.filePath) {
      this.fileTransport = new FileTransport(this.config.filePath)
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error)
  }

  child(context: Record<string, unknown>): IStructuredLogger {
    return new StructuredLogger(this.config, { ...this.baseContext, ...context })
  }

  withCorrelationId(id: string): IStructuredLogger {
    return new StructuredLogger({ ...this.config, correlationId: id }, this.baseContext)
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!shouldLog(this.config.level, level)) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      source: this.config.name,
      correlationId: this.config.correlationId || undefined,
      context: { ...this.baseContext, ...context },
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    }

    // Console output
    if (this.config.console) {
      const formatted = formatConsoleMessage(entry, this.config)
      if (level === 'error') {
        console.error(formatted)
      } else if (level === 'warn') {
        console.warn(formatted)
      } else {
        console.log(formatted)
      }
    }

    // File output
    if (this.fileTransport) {
      this.fileTransport.write(entry)
    }
  }
}

// ============================================================================
// Global Logger Instance
// ============================================================================

let globalStructuredLogger: IStructuredLogger | null = null

export const getStructuredLogger = (): IStructuredLogger => {
  if (!globalStructuredLogger) {
    globalStructuredLogger = new StructuredLogger({
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      name: 'codemachine',
      console: true,
      timestamps: true,
    })
  }
  return globalStructuredLogger
}

export const setStructuredLogger = (logger: IStructuredLogger): void => {
  globalStructuredLogger = logger
}

export const createStructuredLogger = (config: StructuredLoggerConfig): IStructuredLogger => {
  return new StructuredLogger(config)
}

// ============================================================================
// Performance Logging
// ============================================================================

export interface TimerResult {
  duration: number
  formatted: string
}

export const timeAsync = async <T>(
  label: string,
  fn: () => Promise<T>,
  logger: IStructuredLogger = getStructuredLogger()
): Promise<T> => {
  const start = performance.now()
  logger.debug(`${label} started`)

  try {
    const result = await fn()
    const duration = performance.now() - start
    logger.debug(`${label} completed`, { durationMs: Math.round(duration) })
    return result
  } catch (error) {
    const duration = performance.now() - start
    logger.error(`${label} failed`, error as Error, { durationMs: Math.round(duration) })
    throw error
  }
}

export const createTimer = (): { stop: () => TimerResult } => {
  const start = performance.now()

  return {
    stop: () => {
      const duration = performance.now() - start
      return {
        duration,
        formatted: duration < 1000
          ? `${Math.round(duration)}ms`
          : `${(duration / 1000).toFixed(2)}s`,
      }
    },
  }
}

// ============================================================================
// Scoped Logging
// ============================================================================

export const createScopedLogger = (scope: string): IStructuredLogger => {
  return getStructuredLogger().child({ scope })
}

// Pre-defined scoped loggers
export const scopedLoggers = {
  workflow: () => createScopedLogger('workflow'),
  agent: () => createScopedLogger('agent'),
  engine: () => createScopedLogger('engine'),
  state: () => createScopedLogger('state'),
  input: () => createScopedLogger('input'),
  ui: () => createScopedLogger('ui'),
}
