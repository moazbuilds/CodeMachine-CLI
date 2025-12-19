/**
 * Log Stream Hook for OpenTUI/SolidJS
 *
 * Streams log file contents with real-time updates for running agents.
 * Ported from src/ui/hooks/useLogStream.ts (React/Ink version)
 */

import { createSignal, createEffect, onCleanup } from "solid-js"
import { AgentMonitorService } from "../../../../../agents/monitoring/monitor.js"
import type { AgentRecord } from "../../../../../agents/monitoring/types.js"
import { readLogFile, getFileSize, fileExists } from "./log-file-utils"
import { filterHeaderLines, extractLatestThinking } from "./log-parser"

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

export interface LogStreamResult {
  lines: string[]
  isLoading: boolean
  isConnecting: boolean
  error: string | null
  logPath: string
  fileSize: number
  agentName: string
  isRunning: boolean
  latestThinking: string | null
}

/**
 * Hook to stream log file contents with real-time updates for running agents
 * Uses 500ms polling for reliability across all filesystems
 */
export function useLogStream(monitoringAgentId: () => number | undefined): LogStreamResult {
  const [lines, setLines] = createSignal<string[]>([])
  const [isLoading, setIsLoading] = createSignal(true)
  const [isConnecting, setIsConnecting] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [fileSize, setFileSize] = createSignal(0)
  const [agent, setAgent] = createSignal<AgentRecord | null>(null)
  const [latestThinking, setLatestThinking] = createSignal<string | null>(null)

  createEffect(() => {
    const agentId = monitoringAgentId()

    logDebug('Effect triggered, agentId=%s', agentId)

    if (agentId === undefined) {
      logDebug('No agentId, resetting state')
      setIsLoading(true)
      setIsConnecting(false)
      setError(null)
      setLines([])
      return
    }

    let mounted = true
    let pollInterval: NodeJS.Timeout | undefined
    let retryInterval: NodeJS.Timeout | undefined

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
     * Update log lines from file
     */
    function updateLogs(logPath: string): boolean {
      if (!mounted) return false

      try {
        if (!fileExists(logPath)) {
          logDebug('updateLogs: file does not exist: %s', logPath)
          return false
        }

        const fileLines = readLogFile(logPath)
        const filteredLines = filterHeaderLines(fileLines)
        const thinking = extractLatestThinking(fileLines)
        if (mounted) {
          setLines(filteredLines)
          setLatestThinking(thinking)
          setFileSize(getFileSize(logPath))
          setIsConnecting(false)
          setError(null)
          logDebug('updateLogs: success, lines=%d size=%d', filteredLines.length, getFileSize(logPath))
          return true
        }
      } catch (err) {
        logDebug('updateLogs: error reading file: %s', err)
      }
      return false
    }

    /**
     * Start polling for log updates
     */
    function startPolling(logPath: string): void {
      logDebug('startPolling: path=%s', logPath)
      if (pollInterval) {
        clearInterval(pollInterval)
      }

      // 500ms polling
      pollInterval = setInterval(() => {
        if (mounted) {
          updateLogs(logPath)
        }
      }, 500)
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
      setError(null)

      // Initial log read
      const success = updateLogs(agentRecord.logPath)
      logDebug('initialize: initial updateLogs success=%s', success)

      if (mounted) {
        setIsLoading(false)
      }

      // If file doesn't exist yet, set up retry polling
      if (!success && mounted) {
        logDebug('initialize: file not ready, starting retry polling')
        setIsConnecting(true)
        const MAX_RETRIES = 240 // 120 seconds
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

          const retrySuccess = updateLogs(agentRecord.logPath)

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

      // Always start polling for log updates
      if (success) {
        logDebug('initialize: starting polling immediately')
        startPolling(agentRecord.logPath)
      }
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
    })
  })

  return {
    get lines() {
      return lines()
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
  }
}
