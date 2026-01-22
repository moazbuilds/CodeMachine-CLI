/** @jsxImportSource @opentui/solid */
/**
 * History Row Component
 *
 * Single row in the history tree.
 */

import { useTheme } from "@tui/shared/context/theme"
import { formatTokens } from "../../../state/formatters"
import type { FlattenedAgent } from "./history-tree"
import { formatDuration } from "./history-tree"

export interface HistoryRowProps {
  item: FlattenedAgent
  isSelected: boolean
}

export function HistoryRow(props: HistoryRowProps) {
  const themeCtx = useTheme()
  const { agent, depth, isLast, parentIsLast } = props.item

  const prefix = () => {
    let result = ""
    for (let i = 0; i < depth; i++) {
      if (i === depth - 1) {
        result += isLast ? "└─ " : "├─ "
      } else {
        result += parentIsLast[i] ? "   " : "│  "
      }
    }
    return result
  }

  const statusChar = () => {
    const s = agent.status as string
    if (s === "completed") return "●"
    if (s === "failed") return "●"
    if (s === "skipped") return "○"
    return "○"
  }

  const statusColor = () => {
    const s = agent.status as string
    if (s === "completed") return themeCtx.theme.success
    if (s === "failed") return themeCtx.theme.error
    if (s === "skipped") return themeCtx.theme.textMuted
    return themeCtx.theme.warning
  }

  const duration = () => {
    if (agent.duration) return formatDuration(agent.duration)
    if (agent.status === "running") return "Running..."
    return "-"
  }

  const engineModel = () => {
    if (agent.engineProvider && agent.modelName) {
      return `${agent.engineProvider}/${agent.modelName}`
    }
    return agent.engineProvider || "-"
  }

  const displayName = () => prefix() + agent.name
  const truncatedName = () => {
    const name = displayName()
    return name.length > 28 ? name.slice(0, 25) + "..." : name
  }

  const tokens = () => {
    if (agent.telemetry) {
      const total = agent.telemetry.tokensIn + agent.telemetry.tokensOut
      return formatTokens(total)
    }
    return "-"
  }

  const bgColor = () => props.isSelected ? themeCtx.theme.primary : undefined
  const textColor = () => props.isSelected ? themeCtx.theme.background : themeCtx.theme.text
  const mutedColor = () => props.isSelected ? themeCtx.theme.background : themeCtx.theme.textMuted
  const idColor = () => props.isSelected ? themeCtx.theme.background : themeCtx.theme.info

  return (
    <box flexDirection="row" backgroundColor={bgColor()}>
      <box width={6}><text fg={idColor()}>{agent.id}</text></box>
      <box width={30}><text fg={textColor()}>{truncatedName()}</text></box>
      <box width={28}>
        <text fg={mutedColor()}>
          {engineModel().length > 26 ? engineModel().slice(0, 23) + "..." : engineModel()}
        </text>
      </box>
      <box width={12}>
        <text fg={props.isSelected ? themeCtx.theme.background : statusColor()}>
          {statusChar()} {agent.status}
        </text>
      </box>
      <box width={12}><text fg={textColor()}>{duration()}</text></box>
      <box width={22}><text fg={mutedColor()}>{tokens()}</text></box>
    </box>
  )
}
