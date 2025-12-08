/**
 * UI State Utility Functions
 */

import type { WorkflowState } from "./types"
import {
  getCurrentSelection,
  getTimelineLayout,
  calculateScrollOffset,
} from "../../state/navigation"

/**
 * Adjust scroll position to keep selected item visible
 */
export function adjustScroll(
  state: WorkflowState,
  options: { visibleCount?: number; ensureSelectedVisible?: boolean; desiredScrollOffset?: number } = {},
): WorkflowState {
  const resolvedVisible = options.visibleCount ?? state.visibleItemCount
  const visibleLines = Number.isFinite(resolvedVisible) ? Math.max(1, Math.floor(resolvedVisible)) : 1

  const layout = getTimelineLayout(state)
  if (layout.length === 0) {
    const needsUpdate = state.scrollOffset !== 0 || state.visibleItemCount !== visibleLines
    return needsUpdate ? { ...state, scrollOffset: 0, visibleItemCount: visibleLines } : state
  }

  const totalLines = layout[layout.length - 1].offset + layout[layout.length - 1].height
  const maxOffset = Math.max(0, totalLines - visibleLines)
  let desiredOffset = options.desiredScrollOffset ?? state.scrollOffset
  if (!Number.isFinite(desiredOffset)) desiredOffset = 0
  let nextOffset = Math.max(0, Math.min(Math.floor(desiredOffset), maxOffset))

  if (options.ensureSelectedVisible !== false) {
    const selection = getCurrentSelection(state)
    if (selection.id && selection.type) {
      const selectedIndex = layout.findIndex(
        (entry) => entry.item.id === selection.id && entry.item.type === selection.type,
      )
      nextOffset = calculateScrollOffset(layout, selectedIndex, nextOffset, visibleLines)
    } else {
      nextOffset = Math.max(0, Math.min(nextOffset, maxOffset))
    }
  } else {
    nextOffset = Math.max(0, Math.min(nextOffset, maxOffset))
  }

  if (nextOffset === state.scrollOffset && visibleLines === state.visibleItemCount) {
    return state
  }

  return { ...state, scrollOffset: nextOffset, visibleItemCount: visibleLines }
}
