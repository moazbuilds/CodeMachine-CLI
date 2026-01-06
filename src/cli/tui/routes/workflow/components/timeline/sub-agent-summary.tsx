/** @jsxImportSource @opentui/solid */
/**
 * Sub Agent Summary Component
 * Ported from: src/ui/components/SubAgentSummary.tsx
 *
 * Collapsed view showing sub-agent counts and aggregate telemetry
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import type { SubAgentState } from "../../state/types"

export interface SubAgentSummaryProps {
  subAgents: SubAgentState[]
  isExpanded: boolean
  isSelected: boolean
  onToggle: () => void
}

export function SubAgentSummary(props: SubAgentSummaryProps) {
  const themeCtx = useTheme()

  // Don't render if no sub-agents
  const hasSubAgents = () => props.subAgents.length > 0

  const arrow = () => (props.isExpanded ? "▼" : "▶")
  const showArrow = () => props.isSelected

  // Count by status (sub-agents can only be running, completed, or failed)
  const statusStr = () => {
    const counts = {
      completed: 0,
      running: 0,
      failed: 0,
    }

    for (const agent of props.subAgents) {
      if (agent.status in counts) {
        counts[agent.status as keyof typeof counts]++
      }
    }

    const parts: string[] = []
    if (counts.completed > 0) parts.push(`${counts.completed} done`)
    if (counts.running > 0) parts.push(`${counts.running} running`)
    if (counts.failed > 0) parts.push(`${counts.failed} failed`)

    return parts.join(", ")
  }

  // Selection indicator
  const selectionPrefix = () => (showArrow() ? "> " : "  ")

  return (
    <Show when={hasSubAgents()}>
      <box flexDirection="row" paddingLeft={1} paddingRight={1}>
        <text fg={themeCtx.theme.text}>{selectionPrefix()}</text>
        <text fg={themeCtx.theme.textMuted}>
          {arrow()} Sub-agents: {statusStr()}
        </text>
      </box>
    </Show>
  )
}
