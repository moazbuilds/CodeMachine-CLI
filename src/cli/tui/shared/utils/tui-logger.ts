import * as fs from 'node:fs'
import * as path from 'node:path'
import { homedir } from 'os'
import util from 'node:util'

/**
 * TUI Debug Logger
 * Listens to OpenTUI's TerminalConsoleCache events and writes to file
 */

let logStream: fs.WriteStream | null = null
let logListener: ((logEntry: [Date, string, unknown[], unknown]) => void) | null = null

/**
 * Access OpenTUI's singleton cache directly via the global symbol
 */
function getTerminalConsoleCache() {
  const singletonSymbol = Symbol.for('@opentui/core/singleton')
  // @ts-expect-error accessing global singleton cache
  const singletonBag = globalThis[singletonSymbol]
  return singletonBag ? singletonBag['TerminalConsoleCache'] : null
}

/**
 * Initialize TUI logging to file
 * Hooks into OpenTUI's console event system
 */
export function initTUILogger() {
  // Only enable if DEBUG is set
  const debugEnabled = process.env.DEBUG &&
    process.env.DEBUG.trim() !== '' &&
    process.env.DEBUG !== '0' &&
    process.env.DEBUG.toLowerCase() !== 'false'

  if (!debugEnabled) {
    return
  }

  // Create log file in .codemachine/logs/
  const logDir = path.join(homedir(), '.codemachine', 'logs')
  fs.mkdirSync(logDir, { recursive: true })

  const logPath = path.join(logDir, 'tui-debug.log')

  // Open write stream (append mode)
  logStream = fs.createWriteStream(logPath, { flags: 'a' })

  // Write startup marker
  const timestamp = new Date().toISOString()
  logStream.write(`\n${'='.repeat(80)}\n`)
  logStream.write(`[${timestamp}] TUI Session Started\n`)
  logStream.write(`${'='.repeat(80)}\n\n`)

  // Hook into OpenTUI's console event system
  try {
    const terminalConsoleCache = getTerminalConsoleCache()

    if (terminalConsoleCache) {
      logListener = (logEntry: [Date, string, unknown[], unknown]) => {
        handleLogEntry(logEntry)
      }

      terminalConsoleCache.on('entry', logListener)
      logStream.write(`[${new Date().toISOString()}] [INFO] Hooked into OpenTUI console\n`)
    } else {
      logStream.write(`[${new Date().toISOString()}] [WARN] TerminalConsoleCache not found yet\n`)
    }
  } catch (error) {
    // Fallback: just log the error
    if (logStream) {
      logStream.write(`[${new Date().toISOString()}] [ERROR] Failed to hook console: ${error}\n`)
    }
  }
}

/**
 * Handle a log entry from OpenTUI
 */
function handleLogEntry(logEntry: [Date, string, unknown[], unknown]) {
  if (!logStream) return

  const [date, level, args] = logEntry
  const timestamp = date.toISOString()

  const message = args
    .map((arg: unknown) => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack || ''}`
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return util.inspect(arg, { depth: 2 })
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    })
    .join(' ')

  logStream.write(`[${timestamp}] [${level}] ${message}\n`)
}

/**
 * Close the log stream
 */
export function closeTUILogger() {
  // Remove event listener
  if (logListener) {
    try {
      const terminalConsoleCache = getTerminalConsoleCache()

      if (terminalConsoleCache) {
        terminalConsoleCache.off('entry', logListener)
      }
    } catch {
      // Ignore
    }

    logListener = null
  }

  if (logStream) {
    const timestamp = new Date().toISOString()
    logStream.write(`\n[${timestamp}] TUI Session Ended\n\n`)
    logStream.end()
    logStream = null
  }
}
