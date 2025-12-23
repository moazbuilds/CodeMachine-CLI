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

  // Duration calculation:
  // - Running agents: live timer from timer service
  // - Completed agents: frozen duration from UI state
  // - Queued agents: show 00:00
  const duration = () => {
    const { startTime, endTime, status } = props.agent

    // Completed/failed/skipped - show frozen duration
    if (endTime) {
      return formatDuration((endTime - startTime) / 1000)
    }

    // Running agent - use timer service for live updates
    if (status === "running" && startTime > 0) {
      return timer.agentDuration(props.agent.id)
    }

    // Queued/pending - show 00:00
    return "00:00"
  }

  // Selection indicator
  const selectionPrefix = () => (props.isSelected ? "> " : "  ")

  return (
    <box flexDirection="row" paddingLeft={3}>
      <text fg={themeCtx.theme.text}>{selectionPrefix()}</text>
      <Show when={props.agent.status === "running"} fallback={
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
