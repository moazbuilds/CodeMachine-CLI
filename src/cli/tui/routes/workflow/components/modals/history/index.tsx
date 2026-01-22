/** @jsxImportSource @opentui/solid */
/**
 * History View Component
 *
 * Full-screen history view showing all agent executions with OpenTUI scrollbox.
 */

import { createMemo, createEffect, createSignal, onCleanup, For, Show } from "solid-js"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useTheme } from "@tui/shared/context/theme"
import { useRegistrySync } from "../../../hooks/useRegistrySync"
import { flattenTree } from "./history-tree"
import { HistoryRow } from "./history-row"
import { useHistoryNavigation } from "./use-history-navigation"
import { AgentMonitorService } from "../../../../../../../agents/monitoring/index.js"

export interface HistoryViewProps {
  onClose: () => void
  onOpenLogViewer: (monitoringId: number) => void
  initialSelectedIndex?: number
  onSelectedIndexChange?: (index: number) => void
}

export function HistoryView(props: HistoryViewProps) {
  const themeCtx = useTheme()
  const { tree: liveTree, isLoading } = useRegistrySync()
  const [scrollRef, setScrollRef] = createSignal<ScrollBoxRenderable | undefined>()

  // Use liveTree directly for real-time updates
  const flattenedAgents = createMemo(() => flattenTree(liveTree()))

  const handleClearHistory = async () => {
    const monitor = AgentMonitorService.getInstance()
    await monitor.clearAll()
  }

  // Scroll to keep selected item visible (only when out of view)
  const handleScrollToIndex = (index: number) => {
    const ref = scrollRef()
    if (!ref) return
    const rowHeight = 1
    const targetPosition = index * rowHeight
    const visibleHeight = nav.visibleLines()
    const currentScroll = ref.scrollTop

    // If selection is above visible area, scroll up to show it at top
    if (targetPosition < currentScroll) {
      ref.scrollTop = targetPosition
    }
    // If selection is below visible area, scroll down to show it at bottom
    else if (targetPosition >= currentScroll + visibleHeight) {
      ref.scrollTop = targetPosition - visibleHeight + 1
    }
    // Otherwise selection is already visible, don't scroll
  }

  const nav = useHistoryNavigation({
    flattenedAgents,
    initialSelectedIndex: props.initialSelectedIndex,
    onSelectedIndexChange: props.onSelectedIndexChange,
    onClose: props.onClose,
    onOpenLogViewer: props.onOpenLogViewer,
    onClearHistory: handleClearHistory,
    onScrollToIndex: handleScrollToIndex,
  })


  // Sync selection when user scrolls manually with mouse
  createEffect(() => {
    const ref = scrollRef()
    if (!ref) return

    const handleScrollChange = () => {
      const currentScroll = ref.scrollTop
      const visibleHeight = nav.visibleLines()
      const currentSelection = nav.selectedIndex()

      // If selection is above visible area, move it down
      if (currentSelection < currentScroll) {
        nav.setSelectedIndex(Math.floor(currentScroll))
      }
      // If selection is below visible area, move it up
      else if (currentSelection >= currentScroll + visibleHeight) {
        nav.setSelectedIndex(Math.floor(currentScroll + visibleHeight - 1))
      }
    }

    ref.verticalScrollBar?.on("change", handleScrollChange)

    onCleanup(() => {
      ref.verticalScrollBar?.off("change", handleScrollChange)
    })
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
            <box width={22}><text fg={themeCtx.theme.textMuted} attributes={1}>Context</text></box>
          </box>

          {/* Agent Rows - using scrollbox for native scrolling */}
          <scrollbox
            ref={(r: ScrollBoxRenderable) => { setScrollRef(r) }}
            height={nav.visibleLines()}
            width="100%"
            flexGrow={1}
            scrollbarOptions={{
              showArrows: true,
              trackOptions: {
                foregroundColor: themeCtx.theme.info,
                backgroundColor: themeCtx.theme.borderSubtle,
              },
            }}
            focused
          >
            <For each={flattenedAgents()}>
              {(item, index) => (
                <HistoryRow
                  item={item}
                  isSelected={index() === nav.selectedIndex()}
                />
              )}
            </For>
          </scrollbox>

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
