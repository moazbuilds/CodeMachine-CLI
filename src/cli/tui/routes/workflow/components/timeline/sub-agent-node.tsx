/** @jsxImportSource @opentui/solid */
/**
 * Sub Agent Node Component
 *
 * Display a single sub-agent with status, telemetry, and duration
 * Styled similarly to MainAgentNode but with proper indentation for hierarchy
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { useTimer, formatDuration } from "@tui/shared/services"
import { Spinner } from "@tui/shared/components/spinner"
import type { SubAgentState } from "../../state/types"
import { getStatusIcon, getStatusColor } from "./status-utils"

export interface SubAgentNodeProps {
  agent: SubAgentState
  isSelected: boolean
}

export function SubAgentNode(props: SubAgentNodeProps) {
  const themeCtx = useTheme()
  const timer = useTimer()

  const color = () => props.agent.error ? themeCtx.theme.error : getStatusColor(props.agent.status, themeCtx.theme)

  // Duration: running/awaiting = live timer, completed = stored duration, queued = 00:00
  const duration = () => {
    const { duration: storedDuration, status } = props.agent

    // Completed - use stored duration
    if (storedDuration !== undefined) {
      return formatDuration(storedDuration)
    }

    // Running, delegated, or awaiting - live timer (shows frozen time when paused)
    if (status === "running" || status === "delegated" || status === "awaiting") {
      return timer.agentDuration(props.agent.id)
    }

    // Queued/pending - don't show duration
    return ""
  }

  // Selection indicator
  const selectionPrefix = () => (props.isSelected ? "> " : "  ")

  return (
    <box flexDirection="row" paddingLeft={3}>
      <text fg={themeCtx.theme.text}>{selectionPrefix()}</text>
      <Show when={props.agent.status === "running" || props.agent.status === "delegated"} fallback={
        <text fg={color()}>{getStatusIcon(props.agent.status)} </text>
      }>
        <Show when={timer.isPaused()} fallback={
          <>
            <Spinner color={color()} />
            <text> </text>
          </>
        }>
          <text fg={themeCtx.theme.warning}>|| </text>
        </Show>
      </Show>
      <text fg={themeCtx.theme.text}>{props.agent.name}</text>
      <text fg={themeCtx.theme.textMuted}> ({props.agent.engine})</text>
      <Show when={duration()}>
        <text fg={themeCtx.theme.textMuted}> • {duration()}</text>
      </Show>
    </box>
  )
}
