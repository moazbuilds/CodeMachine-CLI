/** @jsxImportSource @opentui/solid */
/**
 * Log Viewer Component
 *
 * Full-screen log viewer with scrolling support.
 */

import { createMemo } from "solid-js"
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

  const monitoringId = () => props.getMonitoringId(props.agentId)
  const logStream = useLogStream(monitoringId)

  const visibleLines = createMemo(() => {
    const height = dimensions()?.height ?? 40
    return Math.max(5, height - 9)
  })

  // Close on Escape
  useModalKeyboard({
    onClose: props.onClose,
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
        lines={logStream.lines}
        isLoading={logStream.isLoading}
        isConnecting={logStream.isConnecting}
        error={logStream.error}
        visibleHeight={visibleLines()}
        isRunning={logStream.isRunning}
      />
      <LogFooter
        total={logStream.lines.length}
        isRunning={logStream.isRunning}
      />
    </box>
  )
}
