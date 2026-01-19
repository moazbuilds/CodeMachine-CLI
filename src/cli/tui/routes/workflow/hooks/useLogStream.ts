/**
 * Log Stream Hook for OpenTUI/SolidJS
 *
 * Streams log file contents with real-time updates for running agents.
 * Optimized with:
 * - Status-aware polling (fast for running, slow/none for inactive)
 * - Incremental file reading (byte offset tracking)
 * - Windowed line storage (memory efficient)
 */

import { createSignal, createEffect, onCleanup, on } from "solid-js"
import { AgentMonitorService } from "../../../../../agents/monitoring/monitor.js"
import type { AgentRecord } from "../../../../../agents/monitoring/types.js"
import { existsSync, statSync, openSync, readSync, closeSync, readFileSync } from "fs"
import type { AgentStatus } from "../state/types.js"
import { processOutputChunk } from "../state/output.js"
import type { ActivityType } from "../../../shared/config/agent-characters.types.js"

// Debug logging (writes to tui-debug.log when DEBUG is enabled)
const DEBUG_ENABLED = process.env.DEBUG &&
  process.env.DEBUG.trim() !== '' &&
  process.env.DEBUG !== '0' &&
  process.env.DEBUG.toLowerCase() !== 'false'

function logDebug(message: string, ...args: unknown[]) {
  if (DEBUG_ENABLED) {
    console.log(`[LogStream] ${message}`, ...args)
  }
}

// Polling intervals based on agent status
const FAST_POLL_MS = 500     // Running agents
const SLOW_POLL_MS = 2000    // Paused/awaiting agents
const GRACE_PERIOD_MS = 3000 // Continue polling after completion

// Threshold for incremental reads vs full reads
const INCREMENTAL_THRESHOLD_BYTES = 10 * 1024 // 10KB

export interface LogStreamOptions {
  monitoringAgentId: () => number | undefined
  agentStatus?: () => AgentStatus | undefined
  visibleLineCount?: () => number
}

export interface LogStreamResult {
  lines: string[]
  totalLineCount: number
  isLoading: boolean
  isConnecting: boolean
  error: string | null
  logPath: string
  fileSize: number
  agentName: string
  isRunning: boolean
  latestThinking: string | null
  currentActivity: ActivityType | null
  hasMoreAbove: boolean
  isLoadingEarlier: boolean
  loadEarlierError: string | null
  loadEarlierLines: () => number
  setPauseTrimming: (pause: boolean) => void
}

/**
 * State for incremental file reading
 */
interface IncrementalReadState {
  lastFileSize: number
  lastLineCount: number
}

/**
 * Result from incremental read operation
 */
interface IncrementalReadResult {
  newLines: string[]
  totalLines: number
  fileSize: number
  wasReset: boolean
}

/**
 * Read log file incrementally using byte offset tracking
 * Only reads new bytes since last read for efficiency
 */
function readLogFileIncremental(
  path: string,
  state: IncrementalReadState
): IncrementalReadResult {
  try {
    if (!existsSync(path)) {
      return { newLines: [], totalLines: 0, fileSize: 0, wasReset: false }
    }

    const stats = statSync(path)
    const currentSize = stats.size

    // File unchanged - skip read
    if (currentSize === state.lastFileSize) {
      return {
        newLines: [],
        totalLines: state.lastLineCount,
        fileSize: currentSize,
        wasReset: false
      }
    }

    // File was truncated/reset - do full read
    if (currentSize < state.lastFileSize) {
      logDebug('File truncated, doing full read. Old size: %d, new size: %d', state.lastFileSize, currentSize)
      const content = readFileSync(path, "utf-8")
      const lines = content.split("\n")
      state.lastFileSize = currentSize
      state.lastLineCount = lines.length
      return {
        newLines: lines,
        totalLines: lines.length,
        fileSize: currentSize,
        wasReset: true
      }
    }

    // For small files, just do a full read (simpler and fast enough)
    if (currentSize < INCREMENTAL_THRESHOLD_BYTES) {
      const content = readFileSync(path, "utf-8")
      const lines = content.split("\n")
      const newLinesCount = lines.length - state.lastLineCount
      state.lastFileSize = currentSize
      state.lastLineCount = lines.length
      return {
        newLines: newLinesCount > 0 ? lines.slice(-newLinesCount) : [],
        totalLines: lines.length,
        fileSize: currentSize,
        wasReset: false
      }
    }

    // Incremental read - only read new bytes
    const bytesToRead = currentSize - state.lastFileSize
    const fd = openSync(path, 'r')
    try {
      const buffer = Buffer.alloc(bytesToRead)
      readSync(fd, buffer, 0, bytesToRead, state.lastFileSize)

      let newContent = buffer.toString('utf-8')

      // Handle potential UTF-8 split: if we start mid-character, find the first newline
      // and discard partial content before it (will be re-read properly later)
      if (state.lastFileSize > 0 && !newContent.startsWith('\n')) {
        // Check if the first byte looks like a UTF-8 continuation byte (starts with 10xxxxxx)
        const firstByte = buffer[0]
        if (firstByte !== undefined && (firstByte & 0xC0) === 0x80) {
          // We're in the middle of a multi-byte character - find first complete line
          const newlineIndex = newContent.indexOf('\n')
          if (newlineIndex > 0) {
            newContent = newContent.substring(newlineIndex + 1)
          }
        }
      }

      const newLines = newContent.split('\n').filter(line => line !== '')

      state.lastFileSize = currentSize
      state.lastLineCount += newLines.length

      return {
        newLines,
        totalLines: state.lastLineCount,
        fileSize: currentSize,
        wasReset: false
      }
    } finally {
      closeSync(fd)
    }
  } catch (err) {
    logDebug('Error in incremental read: %s', err)
    return { newLines: [], totalLines: state.lastLineCount, fileSize: state.lastFileSize, wasReset: false }
  }
}

/**
 * Read entire log file (used for initial load or after truncation)
 */
function readLogFileFull(path: string): string[] {
  try {
    if (!existsSync(path)) {
      return []
    }
    const content = readFileSync(path, "utf-8")
    return content.split("\n")
  } catch {
    return []
  }
}

/**
 * Get file size in bytes
 */
function getFileSize(path: string): number {
  try {
    if (!existsSync(path)) {
      return 0
    }
    return statSync(path).size
  } catch {
    return 0
  }
}

/**
 * Calculate window size based on visible lines
 */
function calculateWindowSize(visibleLineCount: number): number {
  const visible = visibleLineCount || 30
  return Math.ceil(visible * 1.2) // 20% buffer
}

/**
 * State for windowed line storage
 */
interface WindowedLinesState {
  lines: string[]
  totalLineCount: number
  startOffset: number
}

/**
 * Deduplicate new lines by checking for overlap with current lines
 * Returns the portion of newLines that don't already exist at the end of current
 */
function deduplicateNewLines(currentLines: string[], newLines: string[]): string[] {
  if (currentLines.length === 0 || newLines.length === 0) {
    return newLines
  }

  // Check for overlap: find if any prefix of newLines matches the suffix of currentLines
  // Start with larger potential overlaps and work down
  const maxOverlap = Math.min(currentLines.length, newLines.length)

  for (let overlapSize = maxOverlap; overlapSize > 0; overlapSize--) {
    // Check if last 'overlapSize' lines of current match first 'overlapSize' of new
    let isMatch = true
    for (let i = 0; i < overlapSize; i++) {
      const currentIdx = currentLines.length - overlapSize + i
      if (currentLines[currentIdx] !== newLines[i]) {
        isMatch = false
        break
      }
    }
    if (isMatch) {
      logDebug('deduplicateNewLines: found overlap of %d lines, removing duplicates', overlapSize)
      return newLines.slice(overlapSize)
    }
  }

  return newLines
}

/**
 * Update windowed lines with new data, trimming from front if needed
 * @param skipTrim - If true, don't trim lines (used when user has scrolled away)
 */
function updateWindowedLines(
  current: WindowedLinesState,
  newLines: string[],
  totalLines: number,
  maxWindow: number,
  wasReset: boolean,
  skipTrim = false
): WindowedLinesState {
  // If file was reset, start fresh (always trim on reset)
  if (wasReset) {
    const trimCount = Math.max(0, newLines.length - maxWindow)
    return {
      lines: trimCount > 0 ? newLines.slice(trimCount) : newLines,
      totalLineCount: totalLines,
      startOffset: trimCount
    }
  }

  // Deduplicate new lines before appending
  const dedupedNewLines = deduplicateNewLines(current.lines, newLines)

  if (dedupedNewLines.length === 0) {
    // All new lines were duplicates
    return current
  }

  // Append deduplicated new lines
  const allLines = [...current.lines, ...dedupedNewLines]

  // Trim from the front if exceeding window (unless skipTrim is true)
  if (!skipTrim && allLines.length > maxWindow) {
    const trimCount = allLines.length - maxWindow
    return {
      lines: allLines.slice(trimCount),
      startOffset: current.startOffset + trimCount,
      totalLineCount: totalLines
    }
  }

  return {
    lines: allLines,
    startOffset: current.startOffset,
    totalLineCount: totalLines
  }
}

/**
 * Filter out box-style header lines and telemetry from log display
 * Moved to module scope for reuse by loadEarlierLines
 */
function filterHeaderLines(fileLines: string[]): string[] {
  const filtered = fileLines.filter((line) => {
    if (line.includes("╭─") || line.includes("╰─")) return false
    if (line.includes("Started:") || line.includes("Prompt:")) return false
    if (line.includes("Tokens:") && (line.includes("in/") || line.includes("out"))) return false
    return true
  })
  while (filtered.length > 0 && !filtered[0]?.trim()) {
    filtered.shift()
  }
  return filtered
}

/**
 * Determine polling interval based on agent status
 */
function getPollingInterval(status: AgentStatus | undefined): number | null {
  switch (status) {
    case 'running':
    case 'retrying':
      return FAST_POLL_MS
    case 'paused':
    case 'awaiting':
    case 'pending':
    case 'delegated':
      return SLOW_POLL_MS
    case 'completed':
    case 'failed':
    case 'skipped':
      return null // No polling, but grace period handled separately
    default:
      return FAST_POLL_MS // Default to fast polling if status unknown
  }
}

/**
 * Hook to stream log file contents with real-time updates for running agents
 * Optimized with status-aware polling, incremental reads, and windowed storage
 *
 * @param options - Can be a function returning monitoring ID (legacy) or full options object
 */
export function useLogStream(
  options: (() => number | undefined) | LogStreamOptions
): LogStreamResult {
  // Normalize options - support both legacy function signature and new options object
  const opts: LogStreamOptions = typeof options === 'function'
    ? { monitoringAgentId: options }
    : options

  const [windowedState, setWindowedState] = createSignal<WindowedLinesState>({
    lines: [],
    totalLineCount: 0,
    startOffset: 0
  })
  const [isLoading, setIsLoading] = createSignal(true)
  const [isConnecting, setIsConnecting] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [fileSize, setFileSize] = createSignal(0)
  const [agent, setAgent] = createSignal<AgentRecord | null>(null)
  const [latestThinking, setLatestThinking] = createSignal<string | null>(null)
  const [currentLogPath, setCurrentLogPath] = createSignal<string>("")
  const [isLoadingEarlier, setIsLoadingEarlier] = createSignal(false)
  const [loadEarlierError, setLoadEarlierError] = createSignal<string | null>(null)
  const [pauseTrimming, setPauseTrimming] = createSignal(false)
  const [currentActivity, setCurrentActivity] = createSignal<ActivityType | null>(null)

  /**
   * Load earlier lines when user scrolls to top of windowed view
   * Returns the number of lines loaded (for scroll position adjustment)
   * Includes debouncing (won't load if already loading) and error handling
   */
  function loadEarlierLines(): number {
    // Debounce: don't load if already loading
    if (isLoadingEarlier()) {
      logDebug('loadEarlierLines: skipped, already loading')
      return 0
    }

    const current = windowedState()
    const logPath = currentLogPath()

    // Already at the beginning of the file
    if (current.startOffset === 0 || !logPath) return 0

    setIsLoadingEarlier(true)
    setLoadEarlierError(null)

    try {
      const visibleLines = opts.visibleLineCount?.() || 30
      const linesToLoad = calculateWindowSize(visibleLines)

      // Read full file and filter
      const allLines = readLogFileFull(logPath)
      const filteredLines = filterHeaderLines(allLines)

      // Calculate new window boundaries (expand backward)
      const newStartOffset = Math.max(0, current.startOffset - linesToLoad)
      const linesLoaded = current.startOffset - newStartOffset
      const earlierLines = filteredLines.slice(newStartOffset, current.startOffset)

      setWindowedState({
        lines: [...earlierLines, ...current.lines],
        totalLineCount: filteredLines.length,
        startOffset: newStartOffset
      })

      logDebug('loadEarlierLines: loaded %d lines, new startOffset=%d', linesLoaded, newStartOffset)
      setIsLoadingEarlier(false)
      return linesLoaded
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load earlier lines'
      logDebug('loadEarlierLines: error - %s', errorMsg)
      setLoadEarlierError(errorMsg)
      setIsLoadingEarlier(false)
      return 0
    }
  }

  // Use on() to explicitly track ONLY agentId changes, not status changes
  // Status changes are handled within the polling loop to avoid full re-initialization
  createEffect(on(
    () => opts.monitoringAgentId(),
    (agentId) => {
    logDebug('Effect triggered, agentId=%s (status changes handled in polling loop)', agentId)

    if (agentId === undefined) {
      logDebug('No agentId, resetting state')
      setIsLoading(true)
      setIsConnecting(false)
      setError(null)
      setWindowedState({ lines: [], totalLineCount: 0, startOffset: 0 })
      return
    }

    let mounted = true
    let pollInterval: NodeJS.Timeout | undefined
    let retryInterval: NodeJS.Timeout | undefined
    let graceTimeout: NodeJS.Timeout | undefined
    let currentPollMs: number | null = FAST_POLL_MS

    // State for incremental reading
    const incrementalState: IncrementalReadState = {
      lastFileSize: 0,
      lastLineCount: 0
    }

    /**
     * Try to get agent from registry with retries
     */
    async function getAgentWithRetry(attempts = 5, delay = 300): Promise<AgentRecord | null> {
      const monitor = AgentMonitorService.getInstance()
      const id = agentId as number

      logDebug('getAgentWithRetry id=%d attempts=%d', id, attempts)

      for (let i = 0; i < attempts; i++) {
        const agentRecord = monitor.getAgent(id)
        if (agentRecord) {
          logDebug('Found agent on attempt %d: name=%s status=%s logPath=%s',
            i + 1, agentRecord.name, agentRecord.status, agentRecord.logPath)
          return agentRecord
        }

        logDebug('Agent not found on attempt %d/%d', i + 1, attempts)
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      logDebug('Agent not found after %d attempts', attempts)
      return null
    }

    /**
     * Extract latest thinking line from logs
     */
    function extractLatestThinking(fileLines: string[]): string | null {
      for (let i = fileLines.length - 1; i >= 0; i--) {
        const line = fileLines[i]
        if (line && line.includes("Thinking:")) {
          const match = line.match(/Thinking:\s*(.+)/)
          if (match) {
            return match[1].trim()
          }
        }
      }
      return null
    }

    /**
     * Extract current activity from the most recent log lines
     * Looks at the last few lines to determine what the agent is doing
     */
    function extractCurrentActivity(fileLines: string[]): ActivityType {
      // Check the last 5 lines to determine activity
      const recentLines = fileLines.slice(-5)
      for (let i = recentLines.length - 1; i >= 0; i--) {
        const line = recentLines[i]
        if (!line) continue
        const chunk = processOutputChunk(line)
        if (chunk.type === "thinking") return "thinking"
        if (chunk.type === "tool") return "tool"
        if (chunk.type === "error") return "error"
      }
      return "idle"
    }

    /**
     * Update log lines from file using incremental reading
     */
    function updateLogs(logPath: string, forceFullRead = false): boolean {
      if (!mounted) return false

      try {
        if (!existsSync(logPath)) {
          logDebug('updateLogs: file does not exist: %s', logPath)
          return false
        }

        const visibleLines = opts.visibleLineCount?.() || 30
        const maxWindow = calculateWindowSize(visibleLines)

        if (forceFullRead || incrementalState.lastFileSize === 0) {
          // Initial read - do full read
          const fileLines = readLogFileFull(logPath)
          const filteredLines = filterHeaderLines(fileLines)
          const thinking = extractLatestThinking(fileLines)
          const currentFileSize = getFileSize(logPath)

          // Update incremental state - use RAW line count for consistency
          // The incremental read function uses raw line counts to detect new lines
          incrementalState.lastFileSize = currentFileSize
          incrementalState.lastLineCount = fileLines.length

          // Update windowed state
          const trimCount = Math.max(0, filteredLines.length - maxWindow)
          setWindowedState({
            lines: trimCount > 0 ? filteredLines.slice(trimCount) : filteredLines,
            totalLineCount: filteredLines.length,
            startOffset: trimCount
          })
          setLatestThinking(thinking)
          setCurrentActivity(extractCurrentActivity(fileLines))
          setFileSize(currentFileSize)
          setIsConnecting(false)
          setError(null)
          logDebug('updateLogs: full read success, lines=%d size=%d', filteredLines.length, currentFileSize)
          return true
        }

        // Incremental read
        const result = readLogFileIncremental(logPath, incrementalState)

        if (result.wasReset) {
          // File was truncated - filter and update
          const filteredLines = filterHeaderLines(result.newLines)
          const thinking = extractLatestThinking(result.newLines)
          const trimCount = Math.max(0, filteredLines.length - maxWindow)
          setWindowedState({
            lines: trimCount > 0 ? filteredLines.slice(trimCount) : filteredLines,
            totalLineCount: filteredLines.length,
            startOffset: trimCount
          })
          setLatestThinking(thinking)
          setCurrentActivity(extractCurrentActivity(result.newLines))
          setFileSize(result.fileSize)
          logDebug('updateLogs: file reset, lines=%d', filteredLines.length)
          return true
        }

        if (result.newLines.length > 0) {
          // Filter new lines
          const filteredNewLines = filterHeaderLines(result.newLines)

          if (filteredNewLines.length > 0) {
            // Update windowed state with new lines
            const current = windowedState()
            const updated = updateWindowedLines(
              current,
              filteredNewLines,
              current.totalLineCount + filteredNewLines.length,
              maxWindow,
              false,
              pauseTrimming() // Skip trimming when user has scrolled away
            )
            setWindowedState(updated)

            // Check for thinking in new lines
            const thinking = extractLatestThinking(filteredNewLines)
            if (thinking) {
              setLatestThinking(thinking)
            }

            // Update activity based on new lines
            setCurrentActivity(extractCurrentActivity(filteredNewLines))
          }

          setFileSize(result.fileSize)
          logDebug('updateLogs: incremental, new=%d total=%d', filteredNewLines.length, windowedState().totalLineCount)
        }

        return true
      } catch (err) {
        logDebug('updateLogs: error reading file: %s', err)
      }
      return false
    }

    /**
     * Update polling interval based on agent status
     */
    function updatePollingInterval(logPath: string, status: AgentStatus | undefined): void {
      const newPollMs = getPollingInterval(status)

      // Status changed to completed/failed/skipped - start grace period
      if (newPollMs === null && currentPollMs !== null) {
        logDebug('Agent finished, starting grace period polling')
        // Do one final read
        updateLogs(logPath)

        // Continue polling for grace period
        if (pollInterval) {
          clearInterval(pollInterval)
        }
        pollInterval = setInterval(() => {
          if (mounted) updateLogs(logPath)
        }, FAST_POLL_MS)

        graceTimeout = setTimeout(() => {
          logDebug('Grace period ended, stopping polling')
          if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = undefined
          }
        }, GRACE_PERIOD_MS)

        currentPollMs = null
        return
      }

      // No change needed
      if (newPollMs === currentPollMs) return

      // Update interval
      logDebug('Changing poll interval from %dms to %dms', currentPollMs, newPollMs)
      currentPollMs = newPollMs

      if (pollInterval) {
        clearInterval(pollInterval)
      }

      if (newPollMs !== null && mounted) {
        pollInterval = setInterval(() => {
          if (mounted) updateLogs(logPath)
        }, newPollMs)
      }
    }

    /**
     * Initialize log streaming
     */
    async function initialize(): Promise<void> {
      logDebug('initialize: starting')
      const agentRecord = await getAgentWithRetry()

      if (!agentRecord) {
        logDebug('initialize: agent not found, setting error')
        if (mounted) {
          setError("Agent not found in monitoring registry")
          setIsLoading(false)
          setIsConnecting(false)
        }
        return
      }

      if (!mounted) return

      logDebug('initialize: agent found, logPath=%s', agentRecord.logPath)
      setAgent(agentRecord)
      setCurrentLogPath(agentRecord.logPath)
      setError(null)

      // Initial log read
      const success = updateLogs(agentRecord.logPath, true)
      logDebug('initialize: initial updateLogs success=%s', success)

      if (mounted) {
        setIsLoading(false)
      }

      // If file doesn't exist yet, set up retry polling
      if (!success && mounted) {
        logDebug('initialize: file not ready, starting retry polling')
        setIsConnecting(true)
        const MAX_RETRIES = 240
        let currentRetry = 0

        retryInterval = setInterval(() => {
          if (!mounted) {
            clearInterval(retryInterval)
            return
          }

          currentRetry++

          if (currentRetry >= MAX_RETRIES) {
            logDebug('initialize: max retries reached (%d), giving up', MAX_RETRIES)
            clearInterval(retryInterval)
            setIsConnecting(false)
            setError("Can't connect to agent after 120 sec")
            return
          }

          const retrySuccess = updateLogs(agentRecord.logPath, true)

          if (retrySuccess) {
            logDebug('initialize: retry %d succeeded, starting polling', currentRetry)
            clearInterval(retryInterval)
            if (mounted) {
              startPolling(agentRecord.logPath)
            }
          }
        }, 500)

        return
      }

      if (success) {
        logDebug('initialize: starting polling immediately')
        startPolling(agentRecord.logPath)
      }
    }

    /**
     * Start polling for log updates with status-aware interval
     */
    function startPolling(logPath: string): void {
      const status = opts.agentStatus?.()
      currentPollMs = getPollingInterval(status) ?? FAST_POLL_MS

      logDebug('startPolling: path=%s interval=%dms', logPath, currentPollMs)

      if (pollInterval) {
        clearInterval(pollInterval)
      }

      let lastStatus = status

      pollInterval = setInterval(() => {
        if (mounted) {
          updateLogs(logPath)
          // Check if we need to adjust polling interval
          const newStatus = opts.agentStatus?.()
          if (newStatus !== lastStatus) {
            // Status changed - just adjust the polling interval
            // Don't do an extra updateLogs here since we just did one above
            // The new polling interval will naturally handle faster updates
            logDebug('Status changed from %s to %s, adjusting poll interval', lastStatus, newStatus)
            lastStatus = newStatus
            updatePollingInterval(logPath, newStatus)
          }
        }
      }, currentPollMs)
    }

    initialize()

    // Cleanup
    onCleanup(() => {
      logDebug('cleanup: unmounting, clearing intervals')
      mounted = false
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      if (retryInterval) {
        clearInterval(retryInterval)
      }
      if (graceTimeout) {
        clearTimeout(graceTimeout)
      }
    })
  }))

  return {
    get lines() {
      return windowedState().lines
    },
    get totalLineCount() {
      return windowedState().totalLineCount
    },
    get hasMoreAbove() {
      return windowedState().startOffset > 0
    },
    get isLoading() {
      return isLoading()
    },
    get isConnecting() {
      return isConnecting()
    },
    get error() {
      return error()
    },
    get logPath() {
      return agent()?.logPath || ""
    },
    get fileSize() {
      return fileSize()
    },
    get agentName() {
      return agent()?.name || ""
    },
    get isRunning() {
      return agent()?.status === "running"
    },
    get latestThinking() {
      return latestThinking()
    },
    get currentActivity() {
      return currentActivity()
    },
    get isLoadingEarlier() {
      return isLoadingEarlier()
    },
    get loadEarlierError() {
      return loadEarlierError()
    },
    loadEarlierLines,
    setPauseTrimming,
  }
}
