/**
 * Navigation Actions
 *
 * Actions for navigating and selecting items in the timeline.
 */

import type { WorkflowState } from "../types"
import { adjustScroll } from "../utils"
import {
  getCurrentSelection,
  getNextNavigableItem,
  getPreviousNavigableItem,
} from "../../../state/navigation"

export type NavigationActionsContext = {
  getState(): WorkflowState
  setState(state: WorkflowState): void
  notify(): void
  notifyImmediate(): void
}

export function createNavigationActions(ctx: NavigationActionsContext) {
  function selectItem(
    itemId: string,
    itemType: "main" | "summary" | "sub",
    visibleItemCount?: number,
    immediate?: boolean,
  ): void {
    let state = ctx.getState()
    if (itemType === "main") {
      state = { ...state, selectedAgentId: itemId, selectedSubAgentId: null, selectedItemType: "main" }
    } else if (itemType === "summary") {
      state = { ...state, selectedAgentId: itemId, selectedSubAgentId: null, selectedItemType: "summary" }
    } else {
      state = { ...state, selectedSubAgentId: itemId, selectedItemType: "sub" }
    }

    const adjusted = adjustScroll(state, { visibleCount: visibleItemCount })
    ctx.setState(adjusted)
    if (immediate) {
      ctx.notifyImmediate()
    } else {
      ctx.notify()
    }
  }

  function navigateDown(visibleItemCount?: number): void {
    const state = ctx.getState()
    const current = getCurrentSelection(state)
    const next = getNextNavigableItem(current, state)
    if (next) {
      const viewport = visibleItemCount ?? state.visibleItemCount
      selectItem(next.id, next.type, viewport, true)
    }
  }

  function navigateUp(visibleItemCount?: number): void {
    const state = ctx.getState()
    const current = getCurrentSelection(state)
    const prev = getPreviousNavigableItem(current, state)
    if (prev) {
      const viewport = visibleItemCount ?? state.visibleItemCount
      selectItem(prev.id, prev.type, viewport, true)
    }
  }

  function toggleExpand(agentId: string): void {
    const state = ctx.getState()
    const expanded = new Set(state.expandedNodes)
    if (expanded.has(agentId)) expanded.delete(agentId)
    else expanded.add(agentId)
    const updated = { ...state, expandedNodes: expanded }
    ctx.setState(adjustScroll(updated))
    ctx.notify()
  }

  function setVisibleItemCount(count: number): void {
    const state = ctx.getState()
    const sanitized = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1
    const updated: WorkflowState = { ...state, visibleItemCount: sanitized }
    const adjusted = adjustScroll(updated, { visibleCount: sanitized, ensureSelectedVisible: false })
    if (adjusted !== state) {
      ctx.setState(adjusted)
      ctx.notify()
    }
  }

  function setScrollOffset(offset: number, visibleItemCount?: number): void {
    const state = ctx.getState()
    const sanitized = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0
    const adjusted = adjustScroll(state, { visibleCount: visibleItemCount, desiredScrollOffset: sanitized })
    if (adjusted !== state) {
      ctx.setState(adjusted)
      ctx.notify()
    }
  }

  return {
    selectItem,
    navigateDown,
    navigateUp,
    toggleExpand,
    setVisibleItemCount,
    setScrollOffset,
  }
}
