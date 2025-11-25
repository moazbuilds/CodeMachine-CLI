/** @jsxImportSource @opentui/solid */
/**
 * Agent Timeline Component
 * Ported from: src/ui/components/AgentTimeline.tsx
 *
 * Container for all agent displays (main, sub, triggered)
 * Displays main agents in a timeline with expandable sub-agents with smooth scrolling
 */

import { For, Show, createMemo } from "solid-js"
import { useTheme } from "@tui/context/theme"
import type { AgentState, SubAgentState, UIElement, WorkflowState } from "@tui/state/types"
import { getTimelineLayout, type TimelineLayoutEntry } from "@tui/state/navigation"
import { MainAgentNode } from "./main-agent-node"
import { SubAgentSummary } from "./sub-agent-summary"
import { UIElementNode } from "./ui-element-node"

export interface AgentTimelineProps {
  state: WorkflowState
  onToggleExpand: (agentId: string) => void
  availableHeight?: number
}

const TIMELINE_HEADER_HEIGHT = 2 // Header text + padding
const MIN_VIEWPORT_HEIGHT = 1

export function AgentTimeline(props: AgentTimelineProps) {
  const themeCtx = useTheme()

  const viewportHeight = () => {
    const height = props.availableHeight ?? 10
    return Math.max(MIN_VIEWPORT_HEIGHT, height - TIMELINE_HEADER_HEIGHT)
  }

  // Build navigation state for layout calculation
  const layout = createMemo(() => getTimelineLayout(props.state))

  const totalItems = () => layout().length

  const clampedOffset = () => {
    const totalLines =
      layout().length === 0 ? 0 : layout()[layout().length - 1].offset + layout()[layout().length - 1].height
    const maxOffset = Math.max(0, totalLines - viewportHeight())
    return Math.max(0, Math.min(props.state.scrollOffset, maxOffset))
  }

  // Get visible entries based on scroll offset
  const visibleEntries = createMemo<TimelineLayoutEntry[]>(() => {
    const layoutData = layout()
    if (layoutData.length === 0) return []

    const entries: TimelineLayoutEntry[] = []
    const viewportEnd = clampedOffset() + viewportHeight()
    const startIndex = layoutData.findIndex((entry) => entry.offset + entry.height > clampedOffset())

    if (startIndex === -1) return []

    for (let i = startIndex; i < layoutData.length; i++) {
      const entry = layoutData[i]
      if (entry.offset >= viewportEnd) break
      entries.push(entry)
    }

    return entries
  })

  // Header with range info
  const headerSuffix = () => {
    const total = totalItems()
    const viewport = viewportHeight()
    const offset = clampedOffset()

    if (total > 0 && (total > viewport || offset > 0)) {
      const rangeStart = offset + 1
      const rangeEnd = Math.min(offset + viewport, total)
      return ` (${rangeStart}-${rangeEnd} of ${total})`
    }
    return ""
  }

  // Check if item is selected
  const isMainSelected = (itemId: string) =>
    props.state.selectedItemType === "main" && props.state.selectedAgentId === itemId

  const isSummarySelected = (itemId: string) =>
    props.state.selectedItemType === "summary" && props.state.selectedAgentId === itemId

  const isSubSelected = (itemId: string) =>
    props.state.selectedItemType === "sub" && props.state.selectedSubAgentId === itemId

  return (
    <box flexDirection="column" width="100%">
      {/* Header */}
      <box paddingLeft={1} paddingRight={1} paddingBottom={1}>
        <text fg={themeCtx.theme.text} attributes={1}>
          Workflow Pipeline{headerSuffix()}
        </text>
      </box>

      {/* Timeline content */}
      <box flexDirection="column">
        <Show
          when={visibleEntries().length > 0}
          fallback={
            <box paddingLeft={1}>
              <text fg={themeCtx.theme.textMuted}>No agents to display yet.</text>
            </box>
          }
        >
          <For each={visibleEntries()}>
            {(entry) => {
              const { item } = entry

              // Main agent
              if (item.type === "main") {
                return <MainAgentNode agent={item.agent} isSelected={isMainSelected(item.id)} />
              }

              // Sub-agent summary (collapsed)
              if (item.type === "summary") {
                const parentSubAgents = props.state.subAgents.get(item.parentId) || []
                if (parentSubAgents.length === 0) return null

                const isExpanded = props.state.expandedNodes.has(item.parentId)
                return (
                  <SubAgentSummary
                    subAgents={parentSubAgents}
                    isExpanded={isExpanded}
                    isSelected={isSummarySelected(item.id)}
                    onToggle={() => props.onToggleExpand(item.parentId)}
                  />
                )
              }

              // UI element
              if (item.type === "ui") {
                return <UIElementNode uiElement={item.uiElement} />
              }

              // Sub-agent (expanded)
              if (item.type === "sub") {
                return (
                  <box paddingLeft={2}>
                    <MainAgentNode agent={item.agent} isSelected={isSubSelected(item.id)} />
                  </box>
                )
              }

              return null
            }}
          </For>
        </Show>
      </box>
    </box>
  )
}
