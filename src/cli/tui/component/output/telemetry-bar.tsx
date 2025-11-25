/** @jsxImportSource @opentui/solid */
/**
 * Telemetry Bar Component
 * Ported from: src/ui/components/TelemetryBar.tsx
 *
 * Show workflow info, status, and total telemetry in footer
 */

import { Show, Switch, Match } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { formatTokens, formatNumber } from "@tui/state/formatters"
import { ShimmerText } from "./shimmer-text"
import type { WorkflowStatus } from "@tui/state/types"

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
    const base = formatTokens(props.total.tokensIn, props.total.tokensOut)
    return props.total.cached ? `${base} (${formatNumber(props.total.cached)} cached)` : base
  }

  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
      borderStyle="rounded"
    >
      {/* Left side: workflow name, runtime, status */}
      <box flexDirection="row">
        <text fg={themeCtx.theme.text} attributes={1}>
          {props.workflowName}
        </text>
        <text fg={themeCtx.theme.textMuted}> • {props.runtime}</text>
        <text fg={themeCtx.theme.text}> • </text>

        {/* Status with animation for running state */}
        <Switch>
          <Match when={props.status === "running"}>
            <ShimmerText text="Running..." />
          </Match>
          <Match when={props.status === "stopping"}>
            <text fg={themeCtx.theme.warning}>⚠ Press Ctrl+C again to close the session</text>
          </Match>
          <Match when={props.status === "completed"}>
            <text fg={themeCtx.theme.success}>● Completed</text>
          </Match>
          <Match when={props.status === "stopped"}>
            <text fg={themeCtx.theme.error}>⏹ Stopped by user</text>
          </Match>
        </Switch>
      </box>

      {/* Right side: token counts */}
      <box flexDirection="row">
        <text fg={themeCtx.theme.textMuted}>Tokens: </text>
        <text fg={themeCtx.theme.text}>{totalText()}</text>
      </box>
    </box>
  )
}
