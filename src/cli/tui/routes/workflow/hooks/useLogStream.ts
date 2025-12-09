/**
 * Log Stream Hook for OpenTUI/SolidJS
 *
 * Streams log file contents with real-time updates for running agents.
 * Ported from src/ui/hooks/useLogStream.ts (React/Ink version)
 */

import { createSignal, createEffect, onCleanup } from "solid-js"
import { AgentMonitorService } from "../../../../../agents/monitoring/monitor.js"
import type { AgentRecord } from "../../../../../agents/monitoring/types.js"
import { readFileSync, existsSync, statSync } from "fs"

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
 * Read log file and return array of lines
 */
function readLogFile(path: string): string[] {
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

    if (agentId === undefined) {
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
      // agentId is guaranteed to be defined here because we return early if undefined
      const id = agentId as number

      for (let i = 0; i < attempts; i++) {
        const agentRecord = monitor.getAgent(id)
        if (agentRecord) {
          return agentRecord
        }

        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      return null
    }

    /**
     * Filter out box-style header lines and telemetry from log display
     * These are kept in log files for debugging but hidden from UI
     */
    function filterHeaderLines(fileLines: string[]): string[] {
      return fileLines.filter((line) => {
        if (!line) return true // keep empty lines for spacing
        if (line.includes("╭─") || line.includes("╰─")) return false
        if (line.includes("Started:") || line.includes("Prompt:")) return false
        // Filter out token telemetry lines (shown in telemetry bar instead)
        if (line.includes("⏱️") && line.includes("Tokens:")) return false
        return true
      })
    }

    /**
     * Extract latest thinking line from logs
     * Looks for lines with "Thinking:" pattern
     */
    function extractLatestThinking(fileLines: string[]): string | null {
      for (let i = fileLines.length - 1; i >= 0; i--) {
        const line = fileLines[i]
        if (line && line.includes("Thinking:")) {
          // Extract text after "Thinking:" and strip markers
          const match = line.match(/Thinking:\s*(.+)/)
          if (match) {
            return match[1].trim()
          }
        }
      }
      return null
    }

    /**
     * Update log lines from file
     */
    function updateLogs(logPath: string): boolean {
      if (!mounted) return false

      try {
        if (!existsSync(logPath)) {
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
          return true
        }
      } catch {
        // Silently fail - file might not exist yet
      }
      return false
    }

    /**
     * Initialize log streaming
     */
    async function initialize(): Promise<void> {
      const agentRecord = await getAgentWithRetry()

      if (!agentRecord) {
        if (mounted) {
          setError("Agent not found in monitoring registry")
          setIsLoading(false)
          setIsConnecting(false)
        }
        return
      }

      if (!mounted) return

      setAgent(agentRecord)
      setError(null)

      // Initial log read
      const success = updateLogs(agentRecord.logPath)

      if (mounted) {
        setIsLoading(false)
      }

      // If file doesn't exist yet, set up retry polling
      if (!success && mounted) {
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
            clearInterval(retryInterval)
            setIsConnecting(false)
            setError("Can't connect to agent after 120 sec")
            return
          }

          const retrySuccess = updateLogs(agentRecord.logPath)

          if (retrySuccess) {
            clearInterval(retryInterval)
            // Always start polling after successful connection
            if (mounted) {
              startPolling(agentRecord.logPath)
            }
          }
        }, 500)

        return
      }

      // Always start polling for log updates
      if (success) {
        startPolling(agentRecord.logPath)
      }
    }

    /**
     * Start polling for log updates
     */
    function startPolling(logPath: string): void {
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

    initialize()

    // Cleanup
    onCleanup(() => {
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
