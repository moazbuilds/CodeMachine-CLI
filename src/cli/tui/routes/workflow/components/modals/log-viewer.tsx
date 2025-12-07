/** @jsxImportSource @opentui/solid */
/**
 * Log Viewer Component
 * Ported from: src/ui/components/LogViewer.tsx
 *
 * Full-screen log viewer with scrolling support
 * Shows complete log file with real-time updates for running agents
 */

import { createSignal, createMemo, createEffect, For, Show } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { useLogStream } from "../../hooks/useLogStream"
import { LogLine } from "../shared/log-line"

export interface LogViewerProps {
  agentId: string
  getMonitoringId: (uiId: string) => number | undefined
  onClose: () => void
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function LogViewer(props: LogViewerProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [scrollOffset, setScrollOffset] = createSignal(0)

  // Get monitoring ID for this agent
  const monitoringId = () => props.getMonitoringId(props.agentId)

  // Stream logs using the existing hook
  const logStream = useLogStream(monitoringId)

  // Calculate visible lines (terminal height - header - footer - extra padding for live updates label)
  const visibleLines = createMemo(() => {
    const height = dimensions()?.height ?? 40
    return Math.max(5, height - 9)
  })


  // Auto-scroll to bottom for running agents when new content arrives
  createEffect(() => {
    const lineCount = logStream.lines.length
    if (logStream.isRunning && lineCount > 0) {
      const maxOffset = Math.max(0, lineCount - visibleLines())
      setScrollOffset(maxOffset)
    }
  })

  // Get visible lines based on scroll offset
  const displayLines = createMemo(() => {
    const lines = logStream.lines
    if (lines.length === 0) return []
    return lines.slice(scrollOffset(), scrollOffset() + visibleLines())
  })

  // Calculate scroll position info
  const scrollInfo = createMemo(() => {
    const total = logStream.lines.length
    const visible = visibleLines()
    const offset = scrollOffset()
    const startLine = offset + 1
    const endLine = Math.min(offset + displayLines().length, total)
    const percentage = total > visible ? Math.round((offset / Math.max(1, total - visible)) * 100) : 100
    return { startLine, endLine, total, percentage }
  })

  // Keyboard handling
  useKeyboard((evt) => {
    // Escape to close
    if (evt.name === "escape") {
      evt.preventDefault()
      props.onClose()
      return
    }

    // Arrow up - scroll up one line
    if (evt.name === "up") {
      evt.preventDefault()
      setScrollOffset((prev) => Math.max(0, prev - 1))
      return
    }

    // Arrow down - scroll down one line
    if (evt.name === "down") {
      evt.preventDefault()
      const maxOffset = Math.max(0, logStream.lines.length - visibleLines())
      setScrollOffset((prev) => Math.min(maxOffset, prev + 1))
      return
    }

    // Page up
    if (evt.name === "pageup") {
      evt.preventDefault()
      setScrollOffset((prev) => Math.max(0, prev - visibleLines()))
      return
    }

    // Page down
    if (evt.name === "pagedown") {
      evt.preventDefault()
      const maxOffset = Math.max(0, logStream.lines.length - visibleLines())
      setScrollOffset((prev) => Math.min(maxOffset, prev + visibleLines()))
      return
    }

    // Home (g key like vim)
    if (evt.name === "g") {
      evt.preventDefault()
      setScrollOffset(0)
      return
    }

    // End (G key like vim - shift+g)
    if (evt.shift && evt.name === "g") {
      evt.preventDefault()
      const maxOffset = Math.max(0, logStream.lines.length - visibleLines())
      setScrollOffset(maxOffset)
      return
    }
  })

  return (
    <box flexDirection="column" height="100%">
      {/* Header */}
      <box
        border
        borderColor={themeCtx.theme.primary}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={themeCtx.theme.text} attributes={1}>
          Full Logs: {logStream.agentName}
        </text>
        <Show when={logStream.isRunning}>
          <text fg={themeCtx.theme.warning}> (Running)</text>
        </Show>
      </box>

      {/* Path and size info */}
      <box paddingLeft={1} paddingRight={1}>
        <text fg={themeCtx.theme.textMuted}>
          Path: {logStream.logPath} {" "} Size: {formatBytes(logStream.fileSize)}
        </text>
      </box>

      {/* Content area */}
      <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1}>
        <Show when={logStream.isLoading}>
          <box justifyContent="center" alignItems="center" height="100%">
            <text fg={themeCtx.theme.text}>Loading logs...</text>
          </box>
        </Show>

        <Show when={logStream.isConnecting}>
          <box justifyContent="center" alignItems="center" height="100%">
            <text fg={themeCtx.theme.warning}>Connecting to agent log stream...</text>
          </box>
        </Show>

        <Show when={logStream.error}>
          <box justifyContent="center" alignItems="center" height="100%">
            <text fg={themeCtx.theme.error}>Error: {logStream.error}</text>
          </box>
        </Show>

        <Show when={!logStream.isLoading && !logStream.isConnecting && !logStream.error}>
          <Show
            when={logStream.lines.length > 0}
            fallback={
              <box justifyContent="center" alignItems="center" height="100%">
                <text fg={themeCtx.theme.textMuted}>Log file is empty</text>
              </box>
            }
          >
            <box flexDirection="column" height={visibleLines()}>
              <For each={displayLines()}>
                {(line) => <LogLine line={line || " "} />}
              </For>
            </box>
          </Show>
        </Show>
      </box>

      {/* Scroll position indicator */}
      <Show when={!logStream.isLoading && !logStream.error && logStream.lines.length > 0}>
        <box paddingLeft={1} paddingRight={1} flexDirection="row">
          <text fg={themeCtx.theme.textMuted}>
            Lines {scrollInfo().startLine}-{scrollInfo().endLine} of {scrollInfo().total} ({scrollInfo().percentage}%)
          </text>
          <Show when={logStream.isRunning}>
            <text fg={themeCtx.theme.warning}> • Live updates enabled</text>
          </Show>
        </box>
      </Show>

      {/* Footer with shortcuts */}
      <box paddingLeft={1} paddingRight={1}>
        <text fg={themeCtx.theme.textMuted}>
          [Esc] Close  [Up/Down] Scroll  [PgUp/PgDn] Page  [g/G] Top/Bottom
        </text>
      </box>
    </box>
  )
}
