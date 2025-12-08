/** @jsxImportSource @opentui/solid */
/**
 * Log Header Component
 *
 * Shows log file path, size, and running status.
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { formatBytes } from "@tui/shared/utils"

export interface LogHeaderProps {
  agentName: string
  logPath: string
  fileSize: number
  isRunning: boolean
}

export function LogHeader(props: LogHeaderProps) {
  const themeCtx = useTheme()

  return (
    <>
      <box border borderColor={themeCtx.theme.primary} paddingLeft={1} paddingRight={1}>
        <text fg={themeCtx.theme.text} attributes={1}>
          Full Logs: {props.agentName}
        </text>
        <Show when={props.isRunning}>
          <text fg={themeCtx.theme.warning}> (Running)</text>
        </Show>
      </box>
      <box paddingLeft={1} paddingRight={1}>
        <text fg={themeCtx.theme.textMuted}>
          Path: {props.logPath} {" "} Size: {formatBytes(props.fileSize)}
        </text>
      </box>
    </>
  )
}
