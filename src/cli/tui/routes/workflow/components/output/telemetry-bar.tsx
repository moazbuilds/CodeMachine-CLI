/** @jsxImportSource @opentui/solid */
/**
 * Telemetry Bar Component
 * Ported from: src/ui/components/TelemetryBar.tsx
 *
 * Show workflow info, status, and total telemetry in footer
 */

import { Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { formatTokens } from "../../state/formatters"
import type { WorkflowStatus } from "../../state/types"

export interface TelemetryBarProps {
  workflowName: string
  runtime: string
  status: WorkflowStatus
  total: {
    tokensIn: number
    tokensOut: number
  }
  autonomousMode?: boolean
}

/**
 * Show workflow info, status, and total telemetry in footer
 */
// Compact threshold - below this width, use compact layout
const COMPACT_WIDTH = 80

export function TelemetryBar(props: TelemetryBarProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()

  const isCompact = () => (dimensions()?.width ?? 80) < COMPACT_WIDTH

  const totalText = () => {
    return formatTokens(props.total.tokensIn, props.total.tokensOut)
  }

  // Compact token display - no "cached" info
  const compactTokenText = () => {
    return formatTokens(props.total.tokensIn, props.total.tokensOut)
  }

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
      {/* Left side: workflow name, runtime, status, autonomous mode */}
      <box flexDirection="row" flexShrink={1}>
        <text fg={themeCtx.theme.text} attributes={1}>
          {props.workflowName}
        </text>
        <text fg={themeCtx.theme.textMuted}> • {props.runtime}</text>
        <Show when={showStatus()}>
          <text fg={themeCtx.theme.text}> • </text>
          <text fg={statusColor()}>{statusText()}</text>
        </Show>
        <Show when={props.autonomousMode}>
          <text fg={themeCtx.theme.text}> • </text>
          <text fg={themeCtx.theme.primary}>AUTO</text>
        </Show>
      </box>

      {/* Right side: token counts */}
      <box flexDirection="row" flexShrink={0}>
        <Show when={!isCompact()}>
          <text fg={themeCtx.theme.textMuted}>Tokens: </text>
          <text fg={themeCtx.theme.text}>{totalText()}</text>
        </Show>
        <Show when={isCompact()}>
          <text fg={themeCtx.theme.text}>{compactTokenText()}</text>
        </Show>
      </box>
    </box>
  )
}
