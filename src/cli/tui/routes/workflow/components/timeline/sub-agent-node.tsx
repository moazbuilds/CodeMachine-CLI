/** @jsxImportSource @opentui/solid */
/**
 * Sub Agent Node Component
 *
 * Display a single sub-agent with status, telemetry, and duration
 * Styled similarly to MainAgentNode but with proper indentation for hierarchy
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { useTick } from "@tui/shared/hooks/tick"
import { Spinner } from "@tui/shared/components/spinner"
import type { SubAgentState } from "../../state/types"
import { formatDuration, formatTokens } from "../../state/formatters"
import { getStatusIcon, getStatusColor } from "./status-utils"

export interface SubAgentNodeProps {
  agent: SubAgentState
  isSelected: boolean
}

export function SubAgentNode(props: SubAgentNodeProps) {
  const themeCtx = useTheme()
  const now = useTick()

  const color = () => props.agent.error ? themeCtx.theme.error : getStatusColor(props.agent.status, themeCtx.theme)

  const duration = () => {
    const { startTime, endTime, status } = props.agent
    if (endTime) {
      return formatDuration((endTime - startTime) / 1000)
    }
    if (status === "running" && startTime > 0) {
      const elapsed = Math.max(0, now() - startTime)
      return formatDuration(elapsed / 1000)
    }
    return ""
  }

  const tokenStr = () => {
    const { tokensIn, tokensOut } = props.agent.telemetry
    return tokensIn > 0 || tokensOut > 0 ? formatTokens(tokensIn, tokensOut) : ""
  }

  // Selection indicator
  const selectionPrefix = () => (props.isSelected ? "> " : "  ")

  return (
    <box flexDirection="row" paddingLeft={3}>
      <text fg={themeCtx.theme.text}>{selectionPrefix()}</text>
      <Show when={props.agent.status === "running"} fallback={
        <text fg={color()}>{getStatusIcon(props.agent.status)} </text>
      }>
        <Spinner color={color()} />
        <text> </text>
      </Show>
      <text fg={themeCtx.theme.text}>{props.agent.name}</text>
      <text fg={themeCtx.theme.textMuted}> ({props.agent.engine})</text>
      <Show when={props.agent.status === "skipped"}>
        <text fg={themeCtx.theme.textMuted}> • Skipped</text>
      </Show>
      <Show when={duration()}>
        <text fg={themeCtx.theme.text}> • {duration()}</text>
      </Show>
      <Show when={tokenStr()}>
        <text fg={themeCtx.theme.textMuted}> • {tokenStr()}</text>
      </Show>
      <Show when={props.agent.error}>
        <text fg={themeCtx.theme.error}> • Failed</text>
      </Show>
    </box>
  )
}
