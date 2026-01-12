/** @jsxImportSource @opentui/solid */
/**
 * Agent Timeline Component
 * Ported from: src/ui/components/AgentTimeline.tsx
 *
 * Container for all agent displays (main, sub, triggered)
 * Displays main agents in a timeline with expandable sub-agents using OpenTUI scrollbox
 */

import { For, Show, createMemo } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import type { WorkflowState } from "../../state/types"
import { getTimelineLayout } from "../../state/navigation"
import { MainAgentNode } from "./main-agent-node"
import { SubAgentSummary } from "./sub-agent-summary"
import { SubAgentNode } from "./sub-agent-node"
import { SeparatorNode } from "./separator-node"

export interface AgentTimelineProps {
  state: WorkflowState
  onToggleExpand: (agentId: string) => void
  availableHeight?: number
  availableWidth?: number
  isPromptBoxFocused?: boolean
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

  // Header with total count
  const headerSuffix = () => {
    const total = totalItems()
    if (total > 0) {
      return ` (${total} items)`
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
      <box paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
        <text fg={themeCtx.theme.text} attributes={1}>
          Workflow Pipeline{headerSuffix()}
        </text>
      </box>

      {/* Timeline content with scrollbox */}
      <Show
        when={layout().length > 0}
        fallback={
          <box paddingLeft={1}>
            <text fg={themeCtx.theme.textMuted}>Initializing workflow...</text>
          </box>
        }
      >
        <scrollbox
          height={viewportHeight()}
          scrollbarOptions={{ visible: false }}
          viewportCulling={true}
          focused={!props.isPromptBoxFocused}
        >
          <For each={layout()}>
            {(entry) => {
              const { item } = entry

              // Main agent
              if (item.type === "main") {
                return <MainAgentNode agent={item.agent} isSelected={isMainSelected(item.id)} availableWidth={props.availableWidth} />
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

              // Separator (visual divider)
              if (item.type === "separator") {
                return <SeparatorNode separator={item.separator} />
              }

              // Sub-agent (expanded)
              if (item.type === "sub") {
                return <SubAgentNode agent={item.agent} isSelected={isSubSelected(item.id)} />
              }

              return null
            }}
          </For>
        </scrollbox>
      </Show>
    </box>
  )
}
