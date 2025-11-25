import type { AgentState, SubAgentState, UIElement, WorkflowState } from "./types"

export type NavigableItem =
  | { type: "main"; id: string; agent: AgentState }
  | { type: "summary"; id: string; parentId: string }
  | { type: "sub"; id: string; agent: SubAgentState }
  | { type: "ui"; id: string; uiElement: UIElement }

export type SelectableItem =
  | { type: "main"; id: string; agent: AgentState }
  | { type: "summary"; id: string; parentId: string }
  | { type: "sub"; id: string; agent: SubAgentState }

export interface TimelineLayoutEntry {
  item: NavigableItem
  height: number
  offset: number
}

export interface NavigationSelection {
  id: string | null
  type: "main" | "summary" | "sub" | null
}

export function getItemHeight(item: NavigableItem): number {
  if (item.type === "main" && item.agent.loopRound && item.agent.loopRound > 0) {
    return 2
  }
  return 1
}

function getFullItemsList(state: WorkflowState): NavigableItem[] {
  const items: NavigableItem[] = []
  type StepItem =
    | { stepIndex: number; type: "agent"; agent: AgentState }
    | { stepIndex: number; type: "uiElement"; uiElement: UIElement }

  const stepItems: StepItem[] = []

  for (const agent of state.agents) {
    if (agent.stepIndex !== undefined) {
      stepItems.push({ stepIndex: agent.stepIndex, type: "agent", agent })
    }
  }

  for (const uiElement of state.uiElements) {
    stepItems.push({ stepIndex: uiElement.stepIndex, type: "uiElement", uiElement })
  }

  stepItems.sort((a, b) => a.stepIndex - b.stepIndex)

  for (const stepItem of stepItems) {
    if (stepItem.type === "agent") {
      const agent = stepItem.agent
      items.push({ type: "main", id: agent.id, agent })
      const subAgents = state.subAgents.get(agent.id)
      if (subAgents && subAgents.length > 0) {
        items.push({ type: "summary", id: agent.id, parentId: agent.id })
        if (state.expandedNodes.has(agent.id)) {
          for (const subAgent of subAgents) {
            items.push({ type: "sub", id: subAgent.id, agent: subAgent })
          }
        }
      }
    } else {
      items.push({ type: "ui", id: stepItem.uiElement.id, uiElement: stepItem.uiElement })
    }
  }

  return items
}

export function getFlatNavigableList(state: WorkflowState): SelectableItem[] {
  const fullList = getFullItemsList(state)
  return fullList.filter((item) => item.type !== "ui") as SelectableItem[]
}

export function getTimelineLayout(state: WorkflowState): TimelineLayoutEntry[] {
  const items = getFullItemsList(state)
  const layout: TimelineLayoutEntry[] = []
  let offset = 0

  for (const item of items) {
    const height = Math.max(1, getItemHeight(item))
    layout.push({ item, height, offset })
    offset += height
  }

  return layout
}

export function getCurrentSelection(state: WorkflowState): NavigationSelection {
  if (state.selectedItemType === "main" && state.selectedAgentId) {
    return { id: state.selectedAgentId, type: "main" }
  }
  if (state.selectedItemType === "summary" && state.selectedAgentId) {
    return { id: state.selectedAgentId, type: "summary" }
  }
  if (state.selectedItemType === "sub" && state.selectedSubAgentId) {
    return { id: state.selectedSubAgentId, type: "sub" }
  }
  return { id: null, type: null }
}

export function getNextNavigableItem(current: NavigationSelection, state: WorkflowState): SelectableItem | null {
  const items = getFlatNavigableList(state)
  if (items.length === 0) return null
  if (!current.id || !current.type) return items[0]!
  const currentIndex = items.findIndex((item) => item.id === current.id && item.type === current.type)
  if (currentIndex === -1) return items[0]!
  const nextIndex = (currentIndex + 1) % items.length
  return items[nextIndex]!
}

export function getPreviousNavigableItem(current: NavigationSelection, state: WorkflowState): SelectableItem | null {
  const items = getFlatNavigableList(state)
  if (items.length === 0) return null
  if (!current.id || !current.type) return items[items.length - 1]!
  const currentIndex = items.findIndex((item) => item.id === current.id && item.type === current.type)
  if (currentIndex === -1) return items[items.length - 1]!
  const previousIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1
  return items[previousIndex]!
}

export function calculateScrollOffset(
  layout: TimelineLayoutEntry[],
  selectedIndex: number,
  currentScrollOffset: number,
  visibleLines: number
): number {
  if (layout.length === 0) {
    return 0
  }

  const totalLines = layout[layout.length - 1].offset + layout[layout.length - 1].height
  const maxOffset = Math.max(0, totalLines - visibleLines)
  const clampedOffset = Math.max(0, Math.min(currentScrollOffset, maxOffset))

  if (selectedIndex < 0 || selectedIndex >= layout.length) {
    return clampedOffset
  }

  const entry = layout[selectedIndex]
  const itemStart = entry.offset
  const itemEnd = entry.offset + entry.height - 1
  let nextOffset = clampedOffset

  if (itemStart < clampedOffset) {
    nextOffset = itemStart
  } else if (itemEnd >= clampedOffset + visibleLines) {
    nextOffset = itemEnd - visibleLines + 1
  }

  return Math.max(0, Math.min(nextOffset, maxOffset))
}
