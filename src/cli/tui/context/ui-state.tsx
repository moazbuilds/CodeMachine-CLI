/** @jsxImportSource @opentui/solid */
import { type Accessor, createSignal, onCleanup } from "solid-js"
import { createSimpleContext } from "./helper"
import {
  type WorkflowState,
  type AgentStatus,
  type LoopState,
  type SubAgentState,
  type WorkflowStatus,
} from "@tui/state/types"
import {
  getCurrentSelection,
  getNextNavigableItem,
  getPreviousNavigableItem,
  getTimelineLayout,
  calculateScrollOffset,
} from "@tui/state/navigation"
import { updateAgentTelemetryInList } from "@tui/state/utils"
import packageJson from "../../../../package.json" with { type: "json" }

type Listener = () => void

type UIActions = {
  getState(): WorkflowState
  subscribe(fn: Listener): () => void
  addAgent(agent: WorkflowState["agents"][number]): void
  updateAgentStatus(agentId: string, status: AgentStatus): void
  updateAgentTelemetry(agentId: string, telemetry: Partial<WorkflowState["agents"][number]["telemetry"]>): void
  setLoopState(loopState: LoopState | null): void
  clearLoopRound(agentId: string): void
  addSubAgent(parentId: string, subAgent: SubAgentState): void
  batchAddSubAgents(parentId: string, subAgents: SubAgentState[]): void
  updateSubAgentStatus(subAgentId: string, status: AgentStatus): void
  navigateDown(visibleItemCount?: number): void
  navigateUp(visibleItemCount?: number): void
  selectItem(itemId: string, itemType: "main" | "summary" | "sub", visibleItemCount?: number, immediate?: boolean): void
  toggleExpand(agentId: string): void
  setVisibleItemCount(count: number): void
  setScrollOffset(offset: number, visibleItemCount?: number): void
  setWorkflowStatus(status: WorkflowStatus): void
  setCheckpointState(checkpoint: { active: boolean; reason?: string } | null): void
}

function createInitialState(workflowName: string, totalSteps = 0): WorkflowState {
  return {
    workflowName,
    version: packageJson.version,
    packageName: packageJson.name,
    startTime: Date.now(),
    agents: [],
    subAgents: new Map(),
    triggeredAgents: [],
    uiElements: [],
    executionHistory: [],
    loopState: null,
    checkpointState: null,
    expandedNodes: new Set(),
    showTelemetryView: false,
    selectedAgentId: null,
    selectedSubAgentId: null,
    selectedItemType: null,
    visibleItemCount: 10,
    scrollOffset: 0,
    totalSteps,
    workflowStatus: "running",
    agentIdMapVersion: 0,
  }
}

function adjustScroll(
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

function createStore(workflowName: string): UIActions {
  let state = createInitialState(workflowName)
  const listeners = new Set<Listener>()
  let pending: NodeJS.Timeout | null = null
  const throttleMs = 16

  const notify = () => {
    if (pending) return
    pending = setTimeout(() => {
      pending = null
      listeners.forEach((l) => l())
    }, throttleMs)
  }

  const notifyImmediate = () => {
    if (pending) {
      clearTimeout(pending)
      pending = null
    }
    listeners.forEach((l) => l())
  }

  function getState(): WorkflowState {
    return state
  }

  function subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function addAgent(agent: WorkflowState["agents"][number]): void {
    state = { ...state, agents: [...state.agents, agent] }
    notify()
  }

  function updateAgentStatus(agentId: string, status: AgentStatus): void {
    const shouldSetEndTime = status === "completed" || status === "failed" || status === "skipped"
    const shouldSetStartTime = status === "running"
    state = {
      ...state,
      agents: state.agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status,
              startTime: shouldSetStartTime ? Date.now() : agent.startTime,
              endTime: shouldSetEndTime ? Date.now() : agent.endTime,
            }
          : agent,
      ),
    }
    if (status === "running") {
      selectItem(agentId, "main", undefined, true)
      return
    }
    notify()
  }

  function updateAgentTelemetry(
    agentId: string,
    telemetry: Partial<WorkflowState["agents"][number]["telemetry"]>,
  ): void {
    state = { ...state, agents: updateAgentTelemetryInList(state.agents, agentId, telemetry) }
    notify()
  }

  function setLoopState(loopState: LoopState | null): void {
    state = { ...state, loopState }
    if (loopState && loopState.active) {
      state = {
        ...state,
        agents: state.agents.map((agent) =>
          agent.id === loopState.sourceAgent ? { ...agent, loopRound: loopState.iteration, loopReason: loopState.reason } : agent,
        ),
      }
    }
    notify()
  }

  function clearLoopRound(agentId: string): void {
    state = {
      ...state,
      agents: state.agents.map((agent) =>
        agent.id === agentId ? { ...agent, loopRound: undefined, loopReason: undefined } : agent,
      ),
    }
    notify()
  }

  function addSubAgent(parentId: string, subAgent: SubAgentState): void {
    const newSubAgents = new Map(state.subAgents)
    const parentSubAgents = newSubAgents.get(parentId) || []
    const existingIndex = parentSubAgents.findIndex((sa) => sa.id === subAgent.id)
    if (existingIndex >= 0) {
      parentSubAgents[existingIndex] = subAgent
    } else {
      parentSubAgents.push(subAgent)
    }
    newSubAgents.set(parentId, parentSubAgents)
    state = { ...state, subAgents: newSubAgents }
    notify()
  }

  function batchAddSubAgents(parentId: string, subAgents: SubAgentState[]): void {
    if (subAgents.length === 0) return
    const newSubAgents = new Map(state.subAgents)
    const parentSubAgents = newSubAgents.get(parentId) || []
    for (const subAgent of subAgents) {
      const existingIndex = parentSubAgents.findIndex((sa) => sa.id === subAgent.id)
      if (existingIndex >= 0) {
        parentSubAgents[existingIndex] = subAgent
      } else {
        parentSubAgents.push(subAgent)
      }
    }
    newSubAgents.set(parentId, parentSubAgents)
    state = { ...state, subAgents: newSubAgents }
    notify()
  }

  function updateSubAgentStatus(subAgentId: string, status: AgentStatus): void {
    const newSubAgents = new Map(state.subAgents)
    let updated = false
    const shouldSetEndTime = status === "completed" || status === "failed" || status === "skipped"
    for (const [parentId, subAgents] of newSubAgents.entries()) {
      const index = subAgents.findIndex((sa) => sa.id === subAgentId)
      if (index >= 0) {
        const updatedSubAgents = [...subAgents]
        updatedSubAgents[index] = {
          ...updatedSubAgents[index],
          status,
          endTime: shouldSetEndTime ? Date.now() : updatedSubAgents[index].endTime,
        }
        newSubAgents.set(parentId, updatedSubAgents)
        updated = true
        break
      }
    }
    if (updated) {
      state = { ...state, subAgents: newSubAgents }
      notify()
    }
  }

  function navigateDown(visibleItemCount?: number): void {
    const current = getCurrentSelection(state)
    const next = getNextNavigableItem(current, state)
    if (next) {
      const viewport = visibleItemCount ?? state.visibleItemCount
      selectItem(next.id, next.type, viewport, true)
      notifyImmediate()
    }
  }

  function navigateUp(visibleItemCount?: number): void {
    const current = getCurrentSelection(state)
    const prev = getPreviousNavigableItem(current, state)
    if (prev) {
      const viewport = visibleItemCount ?? state.visibleItemCount
      selectItem(prev.id, prev.type, viewport, true)
      notifyImmediate()
    }
  }

  function selectItem(
    itemId: string,
    itemType: "main" | "summary" | "sub",
    visibleItemCount?: number,
    immediate?: boolean,
  ): void {
    if (itemType === "main") {
      state = { ...state, selectedAgentId: itemId, selectedSubAgentId: null, selectedItemType: "main" }
    } else if (itemType === "summary") {
      state = { ...state, selectedAgentId: itemId, selectedSubAgentId: null, selectedItemType: "summary" }
    } else {
      state = { ...state, selectedSubAgentId: itemId, selectedItemType: "sub" }
    }

    const adjusted = adjustScroll(state, { visibleCount: visibleItemCount })
    if (adjusted !== state) state = adjusted
    if (immediate) {
      notifyImmediate()
    } else {
      notify()
    }
  }

  function toggleExpand(agentId: string): void {
    const expanded = new Set(state.expandedNodes)
    if (expanded.has(agentId)) expanded.delete(agentId)
    else expanded.add(agentId)
    state = { ...state, expandedNodes: expanded }
    state = adjustScroll(state)
    notify()
  }

  function setVisibleItemCount(count: number): void {
    const sanitized = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1
    const updated: WorkflowState = { ...state, visibleItemCount: sanitized }
    const adjusted = adjustScroll(updated, { visibleCount: sanitized, ensureSelectedVisible: false })
    if (adjusted !== state) {
      state = adjusted
      notify()
    }
  }

  function setScrollOffset(offset: number, visibleItemCount?: number): void {
    const sanitized = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0
    const adjusted = adjustScroll(state, { visibleCount: visibleItemCount, desiredScrollOffset: sanitized })
    if (adjusted !== state) {
      state = adjusted
      notify()
    }
  }

  function setWorkflowStatus(status: WorkflowStatus): void {
    if (state.workflowStatus === status) return
    if (status === "completed" || status === "stopped" || status === "stopping") {
      state = { ...state, endTime: state.endTime ?? Date.now(), workflowStatus: status }
    } else {
      state = { ...state, workflowStatus: status }
    }
    notify()
  }

  function setCheckpointState(checkpoint: { active: boolean; reason?: string } | null): void {
    state = { ...state, checkpointState: checkpoint }
    if (checkpoint && checkpoint.active) {
      setWorkflowStatus("checkpoint")
    } else {
      setWorkflowStatus("running")
    }
  }

  return {
    getState,
    subscribe,
    addAgent,
    updateAgentStatus,
    updateAgentTelemetry,
    setLoopState,
    clearLoopRound,
    addSubAgent,
    batchAddSubAgents,
    updateSubAgentStatus,
    navigateDown,
    navigateUp,
    selectItem,
    toggleExpand,
    setVisibleItemCount,
    setScrollOffset,
    setWorkflowStatus,
    setCheckpointState,
  }
}

export const { provider: UIStateProvider, use: useUIState } = createSimpleContext({
  name: "UIState",
  init: (props: { workflowName: string }) => {
    const store = createStore(props.workflowName)
    const [state, setState]: [Accessor<WorkflowState>, (v: WorkflowState) => void] = createSignal(store.getState())

    const unsubscribe = store.subscribe(() => {
      setState(store.getState())
    })

    onCleanup(() => unsubscribe())

    return {
      state,
      actions: store,
    }
  },
})
