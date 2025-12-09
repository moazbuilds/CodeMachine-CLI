/** @jsxImportSource @opentui/solid */
/**
 * Telemetry Bar Component
 * Ported from: src/ui/components/TelemetryBar.tsx
 *
 * Show workflow info, status, and total telemetry in footer
 */

import { useTheme } from "@tui/shared/context/theme"
import { formatTokens, formatNumber } from "../../state/formatters"
import type { WorkflowStatus } from "../../state/types"

export interface TelemetryBarProps {
  workflowName: string
  runtime: string
  status: WorkflowStatus
  total: {
    tokensIn: number
    tokensOut: number
    cached?: number
  }
}

/**
 * Show workflow info, status, and total telemetry in footer
 */
export function TelemetryBar(props: TelemetryBarProps) {
  const themeCtx = useTheme()

  const totalText = () => {
    const cached = props.total.cached ?? 0
    const newTokensIn = props.total.tokensIn - cached
    const base = formatTokens(newTokensIn, props.total.tokensOut)
    return cached > 0 ? `${base} (${formatNumber(cached)} cached)` : base
  }

  const showStatus = () => props.status === "checkpoint" || props.status === "paused" || props.status === "stopped"

  const statusColor = () => {
    switch (props.status) {
      case "stopped": return themeCtx.theme.error
      default: return themeCtx.theme.warning
    }
  }

  const statusText = () => {
    switch (props.status) {
      case "checkpoint": return "Checkpoint"
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
      {/* Left side: workflow name, runtime, status */}
      <box flexDirection="row">
        <text fg={themeCtx.theme.text} attributes={1}>
          {props.workflowName}
        </text>
        <text fg={themeCtx.theme.textMuted}> • {props.runtime}</text>
        {showStatus() && <text fg={themeCtx.theme.text}> • </text>}
        {showStatus() && <text fg={statusColor()}>{statusText()}</text>}
      </box>

      {/* Right side: token counts */}
      <box flexDirection="row">
        <text fg={themeCtx.theme.textMuted}>Tokens: </text>
        <text fg={themeCtx.theme.text}>{totalText()}</text>
      </box>
    </box>
  )
}
