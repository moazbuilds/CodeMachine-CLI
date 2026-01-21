/** @jsxImportSource @opentui/solid */
/**
 * Telemetry Bar Component
 * Ported from: src/ui/components/TelemetryBar.tsx
 *
 * Show workflow info, status, and total telemetry in footer
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import type { WorkflowStatus, AutonomousMode } from "../../state/types"

export interface TelemetryBarProps {
  workflowName: string
  runtime: string
  status: WorkflowStatus
  autonomousMode?: AutonomousMode
}

/**
 * Show workflow info, status, and total telemetry in footer
 */
export function TelemetryBar(props: TelemetryBarProps) {
  const themeCtx = useTheme()

  const showStatus = () => props.status === "awaiting" || props.status === "paused" || props.status === "stopped"

  const statusColor = () => {
    switch (props.status) {
      case "stopped": return themeCtx.theme.error
      default: return themeCtx.theme.warning
    }
  }

  const statusText = () => {
    switch (props.status) {
      case "awaiting": return "Awaiting"
      case "paused": return "Paused"
      case "stopped": return "Stopped"
      default: return ""
    }
  }

  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
      borderStyle="rounded"
      borderColor={themeCtx.theme.border}
    >
      {/* Left side: runtime */}
      <box flexDirection="row" flexShrink={0}>
        <text fg={themeCtx.theme.textMuted}>Runtime: </text>
        <text fg={themeCtx.theme.text}>{props.runtime}</text>
      </box>

      {/* Right side: workflow name, status, autonomous mode */}
      <box flexDirection="row" flexShrink={1}>
        <text fg={themeCtx.theme.text} attributes={1}>
          {props.workflowName}
        </text>
        <Show when={showStatus()}>
          <text fg={themeCtx.theme.text}> • </text>
          <text fg={statusColor()}>{statusText()}</text>
        </Show>
        <Show when={props.autonomousMode === 'true' || props.autonomousMode === 'always'}>
          <text fg={themeCtx.theme.text}> • </text>
          <text fg={themeCtx.theme.primary}>{props.autonomousMode === 'always' ? 'AUTO (LOCKED)' : 'AUTO'}</text>
        </Show>
      </box>
    </box>
  )
}
