/** @jsxImportSource @opentui/solid */
/**
 * History View Component
 *
 * Full-screen history view showing all agent executions with OpenTUI scrollbox.
 */

import { createMemo, For, Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { useRegistrySync } from "../../../hooks/useRegistrySync"
import { flattenTree } from "./history-tree"
import { HistoryRow } from "./history-row"
import { useHistoryNavigation } from "./use-history-navigation"
import { AgentMonitorService } from "../../../../../../../agents/monitoring/index.js"

export interface HistoryViewProps {
  onClose: () => void
  onOpenLogViewer: (monitoringId: number) => void
  disabled?: boolean
  initialSelectedIndex?: number
  onSelectedIndexChange?: (index: number) => void
}

export function HistoryView(props: HistoryViewProps) {
  const themeCtx = useTheme()
  const { tree: liveTree, isLoading } = useRegistrySync()

  // Use liveTree directly for real-time updates
  const flattenedAgents = createMemo(() => flattenTree(liveTree()))

  const handleClearHistory = async () => {
    const monitor = AgentMonitorService.getInstance()
    await monitor.clearAll()
  }

  const nav = useHistoryNavigation({
    flattenedAgents,
    initialSelectedIndex: props.initialSelectedIndex,
    onSelectedIndexChange: props.onSelectedIndexChange,
    onClose: props.onClose,
    onOpenLogViewer: props.onOpenLogViewer,
    onClearHistory: handleClearHistory,
    disabled: props.disabled,
  })

  return (
    <Show
      when={!isLoading()}
      fallback={
        <box flexDirection="column" paddingLeft={1} paddingRight={1}>
          <box justifyContent="center" alignItems="center" paddingTop={2} paddingBottom={2}>
            <text fg={themeCtx.theme.text}>Loading history...</text>
          </box>
        </box>
      }
    >
      <Show
        when={flattenedAgents().length > 0}
        fallback={
          <box flexDirection="column" paddingLeft={1} paddingRight={1}>
            <box justifyContent="center" alignItems="center" paddingTop={2} paddingBottom={2}>
              <text fg={themeCtx.theme.textMuted}>No execution history found</text>
            </box>
            <box paddingTop={1}>
              <text fg={themeCtx.theme.textMuted}>[H/Esc] Close</text>
            </box>
          </box>
        }
      >
        <box flexDirection="column" paddingLeft={1} paddingRight={1}>
          <box paddingTop={1} paddingBottom={1}>
            <text fg={themeCtx.theme.text} attributes={1}>Execution History</text>
          </box>

          {/* Column Headers */}
          <box flexDirection="row">
            <box width={6}><text fg={themeCtx.theme.textMuted} attributes={1}>ID</text></box>
            <box width={30}><text fg={themeCtx.theme.textMuted} attributes={1}>Agent</text></box>
            <box width={28}><text fg={themeCtx.theme.textMuted} attributes={1}>Engine/Model</text></box>
            <box width={12}><text fg={themeCtx.theme.textMuted} attributes={1}>Status</text></box>
            <box width={12}><text fg={themeCtx.theme.textMuted} attributes={1}>Duration</text></box>
            <box width={22}><text fg={themeCtx.theme.textMuted} attributes={1}>Tokens</text></box>
          </box>

          {/* Agent Rows - using hook's visible slice for proper scrolling */}
          <box flexDirection="column" height={nav.visibleLines()}>
            <For each={nav.visibleAgents()}>
              {(item, index) => (
                <HistoryRow
                  item={item}
                  isSelected={nav.scrollOffset() + index() === nav.selectedIndex()}
                />
              )}
            </For>
          </box>

          {/* Footer */}
          <Show when={flattenedAgents().length > 0}>
            <box paddingTop={1} flexDirection="row">
              <text fg={themeCtx.theme.textMuted}>
                {flattenedAgents().length} items
              </text>
              <Show when={!nav.pauseUpdates()}>
                <text fg={themeCtx.theme.success}> ●</text>
              </Show>
            </box>
          </Show>

          <box paddingTop={1}>
            <text fg={themeCtx.theme.textMuted}>
              [H/Esc] Close  [Up/Down] Navigate  [g/G] Top/Bottom  [Enter] Logs  [Ctrl+D] Clear
            </text>
          </box>
        </box>
      </Show>
    </Show>
  )
}
