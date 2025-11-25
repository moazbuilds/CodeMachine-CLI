/** @jsxImportSource @opentui/solid */
/**
 * Main Agent Node Component
 * Ported from: src/ui/components/MainAgentNode.tsx
 *
 * Display a single main agent with status, telemetry, and duration
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import type { AgentState } from "../../state/types"
import { calculateDuration, formatTokens } from "../../state/formatters"
import { getStatusIcon, getStatusColor } from "./status-utils"

export interface MainAgentNodeProps {
  agent: AgentState
  isSelected: boolean
}

export function MainAgentNode(props: MainAgentNodeProps) {
  const themeCtx = useTheme()

  const color = () => getStatusColor(props.agent.status, themeCtx.theme)

  const duration = () =>
    calculateDuration({
      startTime: props.agent.startTime,
      endTime: props.agent.endTime,
      status: props.agent.status,
    })

  // Build telemetry display
  const tokenStr = () => {
    const { tokensIn, tokensOut } = props.agent.telemetry
    return tokensIn > 0 || tokensOut > 0 ? formatTokens(tokensIn, tokensOut) : ""
  }

  // Activity counts
  const activityStr = () => {
    const activities: string[] = []
    if (props.agent.toolCount > 0) {
      activities.push(`${props.agent.toolCount} tools`)
    }
    if (props.agent.thinkingCount > 0) {
      activities.push(`${props.agent.thinkingCount} thinking`)
    }
    return activities.length > 0 ? ` • ${activities.join(", ")}` : ""
  }

  const hasLoopRound = () => props.agent.loopRound && props.agent.loopRound > 0

  // Selection indicator
  const selectionPrefix = () => (props.isSelected ? "> " : "  ")

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1}>
      {/* Main line */}
      <box flexDirection="row">
        <text fg={themeCtx.theme.text}>{selectionPrefix()}</text>
        <text fg={color()}>{getStatusIcon(props.agent.status)} </text>
        <text fg={themeCtx.theme.text} attributes={1}>{props.agent.name}</text>
        <text fg={themeCtx.theme.textMuted}> ({props.agent.engine})</text>
        <Show when={duration()}>
          <text fg={themeCtx.theme.text}> • {duration()}</text>
        </Show>
        <Show when={tokenStr()}>
          <text fg={themeCtx.theme.textMuted}> • {tokenStr()}</text>
        </Show>
        <Show when={activityStr()}>
          <text fg={themeCtx.theme.textMuted}>{activityStr()}</text>
        </Show>
        <Show when={props.agent.error}>
          <text fg={themeCtx.theme.error}> • Error: {props.agent.error}</text>
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
