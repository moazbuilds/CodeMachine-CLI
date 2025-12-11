/** @jsxImportSource @opentui/solid */
/**
 * Main Agent Node Component
 * Ported from: src/ui/components/MainAgentNode.tsx
 *
 * Display a single main agent with status, telemetry, and duration
 */

import { Show, createSignal, createEffect, on } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { useTick } from "@tui/shared/hooks/tick"
import { Spinner } from "@tui/shared/components/spinner"
import type { AgentState } from "../../state/types"
import { formatDuration, truncate } from "../../state/formatters"
import { getStatusIcon, getStatusColor } from "./status-utils"

export interface MainAgentNodeProps {
  agent: AgentState
  isSelected: boolean
  isPaused?: boolean
  availableWidth?: number
}

// Maximum agent name length before truncation
const MAX_NAME_LENGTH = 22
// Minimum timeline section width to show engine name
const MIN_WIDTH_FOR_ENGINE = 45

export function MainAgentNode(props: MainAgentNodeProps) {
  const themeCtx = useTheme()
  const now = useTick()

  // Only show engine if timeline section is wide enough
  const showEngine = () => (props.availableWidth ?? 80) >= MIN_WIDTH_FOR_ENGINE

  const color = () => props.agent.error ? themeCtx.theme.error : getStatusColor(props.agent.status, themeCtx.theme)

  // Store pause state for timer freeze/resume
  const [pauseStartTime, setPauseStartTime] = createSignal<number | null>(null)
  const [totalPausedTime, setTotalPausedTime] = createSignal<number>(0)

  // Handle pause/resume transitions
  createEffect(on(
    () => props.isPaused,
    (isPaused, wasPaused) => {
      if (isPaused && !wasPaused) {
        // Just paused - record the time
        setPauseStartTime(Date.now())
      } else if (!isPaused && wasPaused) {
        // Just resumed - add pause duration to total
        const pauseStart = pauseStartTime()
        if (pauseStart !== null) {
          setTotalPausedTime(prev => prev + (Date.now() - pauseStart))
        }
        setPauseStartTime(null)
      }
    },
    { defer: false }
  ))

  const duration = () => {
    const { startTime, endTime, status } = props.agent

    if (endTime) {
      return formatDuration((endTime - startTime) / 1000)
    }

    if (status !== "running" || startTime <= 0) {
      return ""
    }

    const pauseStart = pauseStartTime()
    const totalPaused = totalPausedTime()

    // If currently paused, use pauseStartTime (don't call now())
    if (props.isPaused && pauseStart !== null) {
      const elapsed = (pauseStart - startTime - totalPaused) / 1000
      return formatDuration(Math.max(0, elapsed))
    }

    // Running - use live time minus total paused time
    const elapsed = (now() - startTime - totalPaused) / 1000
    return formatDuration(Math.max(0, elapsed))
  }

  const hasLoopRound = () => props.agent.loopRound && props.agent.loopRound > 0

  // Selection indicator
  const selectionPrefix = () => (props.isSelected ? "> " : "  ")

  const displayName = () => truncate(props.agent.name, MAX_NAME_LENGTH)

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1}>
      {/* Main line - use wrapMode="none" and overflow="hidden" to prevent text wrapping */}
      <box flexDirection="row" overflow="hidden">
        <text wrapMode="none" fg={themeCtx.theme.text}>{selectionPrefix()}</text>
        <Show when={props.agent.status === "running"} fallback={
          <text wrapMode="none" fg={color()}>{getStatusIcon(props.agent.status)} </text>
        }>
          <Show when={props.isPaused} fallback={
            <>
              <Spinner color={color()} />
              <text wrapMode="none"> </text>
            </>
          }>
            <text wrapMode="none" fg={themeCtx.theme.warning}>|| </text>
          </Show>
        </Show>
        <text wrapMode="none" fg={themeCtx.theme.text} attributes={1}>{displayName()}</text>
        <Show when={showEngine()}>
          <text wrapMode="none" fg={themeCtx.theme.textMuted}> ({props.agent.engine})</text>
        </Show>
        <Show when={duration()}>
          <text wrapMode="none" fg={themeCtx.theme.textMuted}> • {duration()}</text>
        </Show>
      </box>

      {/* Loop cycle line (if in loop) */}
      <Show when={hasLoopRound()}>
        <box paddingLeft={2}>
          <text fg={themeCtx.theme.info} attributes={1}>
            ⎿ Cycle {props.agent.loopRound}
            {props.agent.loopReason ? ` - ${props.agent.loopReason}` : ""}
          </text>
        </box>
      </Show>
    </box>
  )
}
