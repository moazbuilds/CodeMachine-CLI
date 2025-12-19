/**
 * Log Streamer with File Watch
 *
 * Streams log file content in real-time using native file watching.
 * Replaces polling with event-driven approach for lower latency.
 *
 * Features:
 * - Native fs.watch for change detection
 * - Incremental reads (only new content)
 * - Async generator API for natural backpressure
 * - Graceful cleanup on close
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Disposable, Unsubscribe } from '../../shared/types'
import { StreamClosedError, StreamError } from '../../shared/errors'

// ============================================================================
// Types
// ============================================================================

export interface LogChunk {
  /** The log content */
  readonly data: string
  /** File position after this chunk */
  readonly position: number
  /** Timestamp when chunk was read */
  readonly timestamp: number
}

export interface LogStreamOptions {
  /** Start reading from this position (default: 0) */
  startPosition?: number
  /** Polling interval fallback in ms (default: 100) */
  pollInterval?: number
  /** Maximum chunk size in bytes (default: 64KB) */
  maxChunkSize?: number
  /** Encoding (default: utf-8) */
  encoding?: BufferEncoding
}

export interface LogStreamerMetrics {
  chunksRead: number
  bytesRead: number
  errors: number
  startedAt: number
  lastReadAt: number | null
}

// ============================================================================
// Log Streamer Implementation
// ============================================================================

export class LogStreamer implements Disposable {
  private readonly logPath: string
  private readonly options: Required<LogStreamOptions>
  private position: number
  private watcher: fs.FSWatcher | null = null
  private isStreaming = false
  private isClosed = false
  private pendingResolve: (() => void) | null = null

  private metrics: LogStreamerMetrics = {
    chunksRead: 0,
    bytesRead: 0,
    errors: 0,
    startedAt: Date.now(),
    lastReadAt: null,
  }

  constructor(logPath: string, options: LogStreamOptions = {}) {
    this.logPath = logPath
    this.options = {
      startPosition: options.startPosition ?? 0,
      pollInterval: options.pollInterval ?? 100,
      maxChunkSize: options.maxChunkSize ?? 64 * 1024,
      encoding: options.encoding ?? 'utf-8',
    }
    this.position = this.options.startPosition
  }

  /**
   * Stream log content as an async generator
   * Yields chunks as they become available
   */
  async *stream(): AsyncGenerator<LogChunk, void, unknown> {
    if (this.isClosed) {
      throw new StreamClosedError(this.logPath)
    }

    if (this.isStreaming) {
      throw new StreamError(this.logPath, 'Already streaming')
    }

    this.isStreaming = true

    try {
      // Wait for file to exist
      await this.waitForFile()

      // Initial read of existing content
      yield* this.readChunks()

      // Set up file watcher
      this.setupWatcher()

      // Continue reading as file changes
      while (!this.isClosed) {
        // Wait for change notification
        await this.waitForChange()

        if (this.isClosed) break

        // Read new content
        yield* this.readChunks()
      }
    } finally {
      this.cleanup()
    }
  }

  /**
   * Read current content without watching for changes
   */
  async readOnce(): Promise<LogChunk[]> {
    const chunks: LogChunk[] = []

    for await (const chunk of this.readChunks()) {
      chunks.push(chunk)
    }

    return chunks
  }

  /**
   * Get current metrics
   */
  getMetrics(): LogStreamerMetrics {
    return { ...this.metrics }
  }

  /**
   * Get current file position
   */
  getPosition(): number {
    return this.position
  }

  /**
   * Close the streamer and release resources
   */
  dispose(): void {
    this.close()
  }

  /**
   * Close the streamer
   */
  close(): void {
    this.isClosed = true

    if (this.pendingResolve) {
      this.pendingResolve()
      this.pendingResolve = null
    }

    this.cleanup()
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async waitForFile(): Promise<void> {
    const maxWait = 30000 // 30 seconds
    const checkInterval = 100
    const startTime = Date.now()

    while (!fs.existsSync(this.logPath)) {
      if (this.isClosed) {
        throw new StreamClosedError(this.logPath)
      }

      if (Date.now() - startTime > maxWait) {
        throw new StreamError(this.logPath, 'Timeout waiting for log file')
      }

      await this.sleep(checkInterval)
    }
  }

  private async *readChunks(): AsyncGenerator<LogChunk, void, unknown> {
    try {
      const stats = await fs.promises.stat(this.logPath)
      const fileSize = stats.size

      // Nothing new to read
      if (fileSize <= this.position) {
        return
      }

      // Read in chunks to avoid memory issues with large files
      while (this.position < fileSize && !this.isClosed) {
        const bytesToRead = Math.min(
          this.options.maxChunkSize,
          fileSize - this.position
        )

        const buffer = Buffer.alloc(bytesToRead)
        const fd = await fs.promises.open(this.logPath, 'r')

        try {
          const { bytesRead } = await fd.read(
            buffer,
            0,
            bytesToRead,
            this.position
          )

          if (bytesRead > 0) {
            this.position += bytesRead
            this.metrics.chunksRead++
            this.metrics.bytesRead += bytesRead
            this.metrics.lastReadAt = Date.now()

            yield {
              data: buffer.slice(0, bytesRead).toString(this.options.encoding),
              position: this.position,
              timestamp: Date.now(),
            }
          }
        } finally {
          await fd.close()
        }
      }
    } catch (error) {
      this.metrics.errors++

      // File might have been deleted/truncated
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Reset position if file was recreated
        this.position = 0
        return
      }

      throw new StreamError(
        this.logPath,
        `Read error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private setupWatcher(): void {
    if (this.watcher) {
      return
    }

    try {
      // Watch the file for changes
      this.watcher = fs.watch(this.logPath, (eventType) => {
        if (eventType === 'change' && this.pendingResolve) {
          this.pendingResolve()
          this.pendingResolve = null
        }
      })

      this.watcher.on('error', (error) => {
        this.metrics.errors++
        console.error(`[LogStreamer] Watch error for ${this.logPath}:`, error)

        // Fall back to polling if watch fails
        this.cleanup()
        this.startPolling()
      })
    } catch {
      // Fall back to polling if watch setup fails
      this.startPolling()
    }
  }

  private startPolling(): void {
    const poll = async () => {
      while (!this.isClosed) {
        await this.sleep(this.options.pollInterval)

        if (this.pendingResolve) {
          try {
            const stats = await fs.promises.stat(this.logPath)
            if (stats.size > this.position) {
              this.pendingResolve()
              this.pendingResolve = null
            }
          } catch {
            // File might not exist yet, continue polling
          }
        }
      }
    }

    poll().catch(console.error)
  }

  private waitForChange(): Promise<void> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve

      // Timeout to prevent hanging indefinitely
      setTimeout(() => {
        if (this.pendingResolve === resolve) {
          this.pendingResolve = null
          resolve()
        }
      }, 5000)
    })
  }

  private cleanup(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    this.isStreaming = false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createLogStreamer = (
  logPath: string,
  options?: LogStreamOptions
): LogStreamer => {
  return new LogStreamer(logPath, options)
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Stream a log file and call a callback for each chunk
 * Returns an unsubscribe function to stop streaming
 */
export const streamLogFile = (
  logPath: string,
  onChunk: (chunk: LogChunk) => void | Promise<void>,
  options?: LogStreamOptions
): Unsubscribe => {
  const streamer = new LogStreamer(logPath, options)

  const stream = async () => {
    try {
      for await (const chunk of streamer.stream()) {
        await onChunk(chunk)
      }
    } catch (error) {
      if (!(error instanceof StreamClosedError)) {
        console.error(`[streamLogFile] Error streaming ${logPath}:`, error)
      }
    }
  }

  stream()

  return () => streamer.close()
}

/**
 * Read a log file from a specific position
 */
export const readLogFromPosition = async (
  logPath: string,
  position: number
): Promise<{ content: string; newPosition: number }> => {
  const streamer = new LogStreamer(logPath, { startPosition: position })
  const chunks = await streamer.readOnce()

  return {
    content: chunks.map((c) => c.data).join(''),
    newPosition: streamer.getPosition(),
  }
}

/**
 * Tail a log file (like `tail -f`)
 */
export const tailLogFile = async function* (
  logPath: string,
  options?: LogStreamOptions & { fromEnd?: number }
): AsyncGenerator<string, void, unknown> {
  // Calculate start position
  let startPosition = 0

  if (options?.fromEnd && fs.existsSync(logPath)) {
    const stats = await fs.promises.stat(logPath)
    startPosition = Math.max(0, stats.size - options.fromEnd)
  }

  const streamer = new LogStreamer(logPath, {
    ...options,
    startPosition,
  })

  try {
    for await (const chunk of streamer.stream()) {
      yield chunk.data
    }
  } finally {
    streamer.close()
  }
}
