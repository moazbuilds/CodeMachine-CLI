/** @jsxImportSource @opentui/solid */
/**
 * Log Viewer Component
 *
 * Full-screen log viewer with scrolling support.
 */

import { createSignal, createMemo, createEffect } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useModalKeyboard } from "@tui/shared/hooks"
import { useLogStream } from "../../../hooks/useLogStream"
import { LogHeader } from "./log-header"
import { LogContent } from "./log-content"
import { LogFooter } from "./log-footer"

export interface LogViewerProps {
  agentId: string
  getMonitoringId: (uiId: string) => number | undefined
  onClose: () => void
}

export function LogViewer(props: LogViewerProps) {
  const dimensions = useTerminalDimensions()
  const [scrollOffset, setScrollOffset] = createSignal(0)

  const monitoringId = () => props.getMonitoringId(props.agentId)
  const logStream = useLogStream(monitoringId)

  const visibleLines = createMemo(() => {
    const height = dimensions()?.height ?? 40
    return Math.max(5, height - 9)
  })

  // Auto-scroll for running agents
  createEffect(() => {
    const lineCount = logStream.lines.length
    if (logStream.isRunning && lineCount > 0) {
      const maxOffset = Math.max(0, lineCount - visibleLines())
      setScrollOffset(maxOffset)
    }
  })

  const displayLines = createMemo(() => {
    const lines = logStream.lines
    if (lines.length === 0) return []
    return lines.slice(scrollOffset(), scrollOffset() + visibleLines())
  })

  const scrollInfo = createMemo(() => {
    const total = logStream.lines.length
    const visible = visibleLines()
    const offset = scrollOffset()
    const startLine = offset + 1
    const endLine = Math.min(offset + displayLines().length, total)
    const percentage = total > visible ? Math.round((offset / Math.max(1, total - visible)) * 100) : 100
    return { startLine, endLine, total, percentage }
  })

  useModalKeyboard({
    onClose: props.onClose,
    onScrollUp: () => setScrollOffset((prev) => Math.max(0, prev - 1)),
    onScrollDown: () => {
      const maxOffset = Math.max(0, logStream.lines.length - visibleLines())
      setScrollOffset((prev) => Math.min(maxOffset, prev + 1))
    },
    onPageUp: () => setScrollOffset((prev) => Math.max(0, prev - visibleLines())),
    onPageDown: () => {
      const maxOffset = Math.max(0, logStream.lines.length - visibleLines())
      setScrollOffset((prev) => Math.min(maxOffset, prev + visibleLines()))
    },
    onGoTop: () => setScrollOffset(0),
    onGoBottom: () => {
      const maxOffset = Math.max(0, logStream.lines.length - visibleLines())
      setScrollOffset(maxOffset)
    },
  })

  return (
    <box flexDirection="column" height="100%">
      <LogHeader
        agentName={logStream.agentName}
        logPath={logStream.logPath}
        fileSize={logStream.fileSize}
        isRunning={logStream.isRunning}
      />
      <LogContent
        lines={displayLines()}
        isLoading={logStream.isLoading}
        isConnecting={logStream.isConnecting}
        error={logStream.error}
        visibleHeight={visibleLines()}
      />
      <LogFooter
        startLine={scrollInfo().startLine}
        endLine={scrollInfo().endLine}
        total={scrollInfo().total}
        percentage={scrollInfo().percentage}
        isRunning={logStream.isRunning}
      />
    </box>
  )
}
