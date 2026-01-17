/** @jsxImportSource @opentui/solid */
/**
 * Log Content Component
 *
 * Displays scrollable log lines with OpenTUI scrollbox.
 */

import type { ScrollBoxRenderable } from "@opentui/core"
import { Show, For, createSignal, createEffect, onCleanup, on } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { LogLine } from "../../shared/log-line"
import { LogTable } from "../../shared/log-table"
import { groupLinesWithTables } from "../../shared/markdown-table"
import { debug } from "../../../../../../../shared/logging/logger.js"

export interface LogContentProps {
  lines: string[]
  isLoading: boolean
  isConnecting: boolean
  error: string | null
  visibleHeight: number
  isRunning?: boolean
  totalLineCount?: number
  hasMoreAbove?: boolean
  isLoadingEarlier?: boolean
  loadEarlierError?: string | null
  onLoadMore?: () => number
}

export function LogContent(props: LogContentProps) {
  debug('[LogContent] Component rendering, lines=%d, isLoading=%s, hasMoreAbove=%s',
    props.lines.length, props.isLoading, props.hasMoreAbove)

  const themeCtx = useTheme()
  const [scrollRef, setScrollRef] = createSignal<ScrollBoxRenderable | undefined>()
  const [userScrolledAway, setUserScrolledAway] = createSignal(false)
  const [prevLineCount, setPrevLineCount] = createSignal(0)

  // Reset userScrolledAway when lines reset (indicates agent/log change)
  createEffect(() => {
    const currentCount = props.lines.length
    const prev = prevLineCount()
    // If lines dropped significantly (more than 50% or to near zero), it's a new log
    if (prev > 10 && currentCount < prev * 0.5) {
      debug('[LogContent] Lines reset detected (prev=%d, current=%d), resetting scroll state', prev, currentCount)
      setUserScrolledAway(false)
    }
    setPrevLineCount(currentCount)
  })

  // Handle scroll events: load earlier lines + track if user scrolled away from bottom
  createEffect(() => {
    const ref = scrollRef()
    debug('[LogContent] Effect running, ref exists: %s', !!ref)
    if (!ref) return

    const handleScrollChange = () => {
      const scrollTop = ref.scrollTop
      const scrollHeight = ref.scrollHeight
      const viewportHeight = ref.height
      const maxScroll = Math.max(0, scrollHeight - viewportHeight)
      const isAtBottom = scrollTop >= maxScroll - 3

      debug('[LogContent] scroll: top=%d, max=%d, atBottom=%s, hasMore=%s', scrollTop, maxScroll, isAtBottom, props.hasMoreAbove)

      // Track if user scrolled away from bottom (to disable stickyScroll)
      if (!isAtBottom && !userScrolledAway()) {
        debug('[LogContent] User scrolled away from bottom')
        setUserScrolledAway(true)
      } else if (isAtBottom && userScrolledAway()) {
        debug('[LogContent] User returned to bottom')
        setUserScrolledAway(false)
      }

      // Trigger load when near the top (within 3 lines) - skip if already loading
      if (scrollTop <= 3 && props.hasMoreAbove && props.onLoadMore && !props.isLoadingEarlier) {
        debug('[LogContent] Loading earlier lines...')
        const linesLoaded = props.onLoadMore()
        debug('[LogContent] Lines loaded: %d', linesLoaded)
        if (linesLoaded > 0) {
          ref.scrollTop = linesLoaded  // Maintain view position
        }
      }
    }

    debug('[LogContent] Setting up scroll listener, verticalScrollBar exists: %s', !!ref.verticalScrollBar)
    ref.verticalScrollBar?.on("change", handleScrollChange)
    onCleanup(() => ref.verticalScrollBar?.off("change", handleScrollChange))
  })

  // Compute whether stickyScroll should be active (only when running AND user hasn't scrolled away)
  const shouldStickyScroll = () => (props.isRunning ?? true) && !userScrolledAway()

  return (
    <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1}>
      <Show when={props.isLoading}>
        <box justifyContent="center" alignItems="center" height="100%">
          <text fg={themeCtx.theme.text}>Loading logs...</text>
        </box>
      </Show>

      <Show when={props.isConnecting}>
        <box justifyContent="center" alignItems="center" height="100%">
          <text fg={themeCtx.theme.warning}>Connecting to agent log stream...</text>
        </box>
      </Show>

      <Show when={props.error}>
        <box justifyContent="center" alignItems="center" height="100%">
          <text fg={themeCtx.theme.error}>Error: {props.error}</text>
        </box>
      </Show>

      <Show when={!props.isLoading && !props.isConnecting && !props.error}>
        <Show
          when={props.lines.length > 0}
          fallback={
            <box justifyContent="center" alignItems="center" height="100%">
              <text fg={themeCtx.theme.textMuted}>Log file is empty</text>
            </box>
          }
        >
          {/* Loading earlier lines indicator */}
          <Show when={props.isLoadingEarlier}>
            <text fg={themeCtx.theme.info}>↑ Loading earlier lines...</text>
          </Show>
          {/* Error loading earlier lines */}
          <Show when={props.loadEarlierError}>
            <text fg={themeCtx.theme.error}>↑ Error: {props.loadEarlierError}</text>
          </Show>
          {/* More above indicator (when not loading) */}
          <Show when={props.hasMoreAbove && !props.isLoadingEarlier && !props.loadEarlierError}>
            <text fg={themeCtx.theme.textMuted}>↑ Scroll up or press [g] for earlier logs</text>
          </Show>
          <scrollbox
            ref={(r: ScrollBoxRenderable) => setScrollRef(r)}
            height={props.visibleHeight}
            width="100%"
            stickyScroll={shouldStickyScroll()}
            stickyStart="bottom"
            scrollbarOptions={{
              showArrows: true,
              trackOptions: {
                foregroundColor: themeCtx.theme.info,
                backgroundColor: themeCtx.theme.borderSubtle,
              },
            }}
            viewportCulling={true}
            focused={true}
          >
            <For each={groupLinesWithTables(props.lines)}>
              {(group) => (
                <Show
                  when={group.type === 'table'}
                  fallback={<LogLine line={group.lines[0] || " "} />}
                >
                  <LogTable lines={group.lines} />
                </Show>
              )}
            </For>
          </scrollbox>
        </Show>
      </Show>
    </box>
  )
}
