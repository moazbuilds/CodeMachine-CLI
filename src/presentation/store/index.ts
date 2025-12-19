/**
 * Unified TUI State Store
 *
 * Single source of truth for all UI state.
 * Replaces context sprawl with a centralized, slice-based store.
 *
 * Features:
 * - Immutable state updates
 * - Batched updates for performance
 * - Type-safe selectors
 * - Subscription-based reactivity
 */

import { createSignal, createMemo, batch } from 'solid-js'
import type { Unsubscribe, AgentId, WorkflowStatus, AgentStatus, Telemetry } from '../../shared/types'

// ============================================================================
// State Slice Types
// ============================================================================

export interface WorkflowSlice {
  readonly status: WorkflowStatus
  readonly currentStepIndex: number
  readonly totalSteps: number
  readonly mode: 'user' | 'autopilot'
  readonly startedAt: number | null
  readonly telemetry: Telemetry
}

export interface AgentState {
  readonly id: AgentId
  readonly name: string
  readonly engine: string
  readonly status: AgentStatus
  readonly stepIndex: number
  readonly isSelected: boolean
  readonly isExpanded: boolean
  readonly telemetry: Telemetry
  readonly duration: number
}

export interface SubAgentState {
  readonly id: AgentId
  readonly name: string
  readonly parentId: AgentId
  readonly status: AgentStatus
  readonly model: string | null
}

export interface AgentsSlice {
  readonly agents: AgentState[]
  readonly subAgents: Map<AgentId, SubAgentState[]>
  readonly selectedAgentId: AgentId | null
  readonly selectedSubAgentId: AgentId | null
}

export interface UISlice {
  readonly timelineCollapsed: boolean
  readonly visibleItemCount: number
  readonly scrollOffset: number
  readonly theme: 'dark' | 'light'
  readonly terminalWidth: number
  readonly terminalHeight: number
}

export interface ModalsSlice {
  readonly logViewerOpen: boolean
  readonly logViewerAgentId: AgentId | null
  readonly historyViewOpen: boolean
  readonly stopConfirmOpen: boolean
  readonly errorModalOpen: boolean
  readonly errorMessage: string | null
  readonly checkpointModalOpen: boolean
  readonly checkpointMessage: string | null
}

export interface InputSlice {
  readonly isWaiting: boolean
  readonly prompt: string | null
  readonly chainedPrompts: Array<{ name: string; label: string }> | null
  readonly currentChainIndex: number
}

// ============================================================================
// Root State
// ============================================================================

export interface AppState {
  readonly workflow: WorkflowSlice
  readonly agents: AgentsSlice
  readonly ui: UISlice
  readonly modals: ModalsSlice
  readonly input: InputSlice
}

// ============================================================================
// Initial State
// ============================================================================

const initialWorkflowState: WorkflowSlice = {
  status: 'idle',
  currentStepIndex: 0,
  totalSteps: 0,
  mode: 'user',
  startedAt: null,
  telemetry: { tokensIn: 0, tokensOut: 0, cost: 0 },
}

const initialAgentsState: AgentsSlice = {
  agents: [],
  subAgents: new Map(),
  selectedAgentId: null,
  selectedSubAgentId: null,
}

const initialUIState: UISlice = {
  timelineCollapsed: false,
  visibleItemCount: 10,
  scrollOffset: 0,
  theme: 'dark',
  terminalWidth: 120,
  terminalHeight: 40,
}

const initialModalsState: ModalsSlice = {
  logViewerOpen: false,
  logViewerAgentId: null,
  historyViewOpen: false,
  stopConfirmOpen: false,
  errorModalOpen: false,
  errorMessage: null,
  checkpointModalOpen: false,
  checkpointMessage: null,
}

const initialInputState: InputSlice = {
  isWaiting: false,
  prompt: null,
  chainedPrompts: null,
  currentChainIndex: 0,
}

const initialState: AppState = {
  workflow: initialWorkflowState,
  agents: initialAgentsState,
  ui: initialUIState,
  modals: initialModalsState,
  input: initialInputState,
}

// ============================================================================
// Action Types
// ============================================================================

export type Action =
  // Workflow actions
  | { type: 'WORKFLOW_SET_STATUS'; status: WorkflowStatus }
  | { type: 'WORKFLOW_SET_MODE'; mode: 'user' | 'autopilot' }
  | { type: 'WORKFLOW_SET_STEP'; stepIndex: number; totalSteps: number }
  | { type: 'WORKFLOW_START'; totalSteps: number }
  | { type: 'WORKFLOW_ADD_TELEMETRY'; telemetry: Partial<Telemetry> }
  // Agent actions
  | { type: 'AGENT_ADD'; agent: Omit<AgentState, 'isSelected' | 'isExpanded'> }
  | { type: 'AGENT_UPDATE_STATUS'; agentId: AgentId; status: AgentStatus }
  | { type: 'AGENT_UPDATE_TELEMETRY'; agentId: AgentId; telemetry: Partial<Telemetry> }
  | { type: 'AGENT_UPDATE_DURATION'; agentId: AgentId; duration: number }
  | { type: 'AGENT_SELECT'; agentId: AgentId | null }
  | { type: 'AGENT_TOGGLE_EXPAND'; agentId: AgentId }
  | { type: 'AGENT_CLEAR_ALL' }
  // SubAgent actions
  | { type: 'SUBAGENT_ADD'; parentId: AgentId; subAgent: SubAgentState }
  | { type: 'SUBAGENT_BATCH_ADD'; parentId: AgentId; subAgents: SubAgentState[] }
  | { type: 'SUBAGENT_UPDATE_STATUS'; parentId: AgentId; subAgentId: AgentId; status: AgentStatus }
  | { type: 'SUBAGENT_SELECT'; parentId: AgentId; subAgentId: AgentId | null }
  | { type: 'SUBAGENT_CLEAR'; parentId: AgentId }
  // UI actions
  | { type: 'UI_TOGGLE_TIMELINE' }
  | { type: 'UI_SET_SCROLL'; offset: number }
  | { type: 'UI_SET_VISIBLE_COUNT'; count: number }
  | { type: 'UI_SET_TERMINAL_SIZE'; width: number; height: number }
  | { type: 'UI_SET_THEME'; theme: 'dark' | 'light' }
  // Modal actions
  | { type: 'MODAL_OPEN_LOG_VIEWER'; agentId: AgentId }
  | { type: 'MODAL_CLOSE_LOG_VIEWER' }
  | { type: 'MODAL_OPEN_HISTORY' }
  | { type: 'MODAL_CLOSE_HISTORY' }
  | { type: 'MODAL_OPEN_STOP_CONFIRM' }
  | { type: 'MODAL_CLOSE_STOP_CONFIRM' }
  | { type: 'MODAL_OPEN_ERROR'; message: string }
  | { type: 'MODAL_CLOSE_ERROR' }
  | { type: 'MODAL_OPEN_CHECKPOINT'; message: string }
  | { type: 'MODAL_CLOSE_CHECKPOINT' }
  // Input actions
  | { type: 'INPUT_SET_WAITING'; isWaiting: boolean; prompt?: string }
  | { type: 'INPUT_SET_CHAINED'; prompts: Array<{ name: string; label: string }> | null }
  | { type: 'INPUT_ADVANCE_CHAIN' }
  | { type: 'INPUT_CLEAR' }
  // Batch action
  | { type: 'BATCH'; actions: Action[] }

// ============================================================================
// Reducer
// ============================================================================

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // Workflow
    case 'WORKFLOW_SET_STATUS':
      return { ...state, workflow: { ...state.workflow, status: action.status } }

    case 'WORKFLOW_SET_MODE':
      return { ...state, workflow: { ...state.workflow, mode: action.mode } }

    case 'WORKFLOW_SET_STEP':
      return {
        ...state,
        workflow: {
          ...state.workflow,
          currentStepIndex: action.stepIndex,
          totalSteps: action.totalSteps,
        },
      }

    case 'WORKFLOW_START':
      return {
        ...state,
        workflow: {
          ...state.workflow,
          status: 'running',
          startedAt: Date.now(),
          totalSteps: action.totalSteps,
        },
      }

    case 'WORKFLOW_ADD_TELEMETRY':
      return {
        ...state,
        workflow: {
          ...state.workflow,
          telemetry: {
            tokensIn: state.workflow.telemetry.tokensIn + (action.telemetry.tokensIn ?? 0),
            tokensOut: state.workflow.telemetry.tokensOut + (action.telemetry.tokensOut ?? 0),
            cost: state.workflow.telemetry.cost + (action.telemetry.cost ?? 0),
            cached: (state.workflow.telemetry.cached ?? 0) + (action.telemetry.cached ?? 0),
          },
        },
      }

    // Agents
    case 'AGENT_ADD':
      return {
        ...state,
        agents: {
          ...state.agents,
          agents: [
            ...state.agents.agents,
            { ...action.agent, isSelected: false, isExpanded: true },
          ],
        },
      }

    case 'AGENT_UPDATE_STATUS':
      return {
        ...state,
        agents: {
          ...state.agents,
          agents: state.agents.agents.map((a) =>
            a.id === action.agentId ? { ...a, status: action.status } : a
          ),
        },
      }

    case 'AGENT_UPDATE_TELEMETRY':
      return {
        ...state,
        agents: {
          ...state.agents,
          agents: state.agents.agents.map((a) =>
            a.id === action.agentId
              ? {
                  ...a,
                  telemetry: {
                    tokensIn: a.telemetry.tokensIn + (action.telemetry.tokensIn ?? 0),
                    tokensOut: a.telemetry.tokensOut + (action.telemetry.tokensOut ?? 0),
                    cost: a.telemetry.cost + (action.telemetry.cost ?? 0),
                    cached: (a.telemetry.cached ?? 0) + (action.telemetry.cached ?? 0),
                  },
                }
              : a
          ),
        },
      }

    case 'AGENT_UPDATE_DURATION':
      return {
        ...state,
        agents: {
          ...state.agents,
          agents: state.agents.agents.map((a) =>
            a.id === action.agentId ? { ...a, duration: action.duration } : a
          ),
        },
      }

    case 'AGENT_SELECT':
      return {
        ...state,
        agents: {
          ...state.agents,
          selectedAgentId: action.agentId,
          agents: state.agents.agents.map((a) => ({
            ...a,
            isSelected: a.id === action.agentId,
          })),
        },
      }

    case 'AGENT_TOGGLE_EXPAND':
      return {
        ...state,
        agents: {
          ...state.agents,
          agents: state.agents.agents.map((a) =>
            a.id === action.agentId ? { ...a, isExpanded: !a.isExpanded } : a
          ),
        },
      }

    case 'AGENT_CLEAR_ALL':
      return {
        ...state,
        agents: initialAgentsState,
      }

    // SubAgents
    case 'SUBAGENT_ADD': {
      const newSubAgents = new Map(state.agents.subAgents)
      const existing = newSubAgents.get(action.parentId) ?? []
      newSubAgents.set(action.parentId, [...existing, action.subAgent])
      return {
        ...state,
        agents: { ...state.agents, subAgents: newSubAgents },
      }
    }

    case 'SUBAGENT_BATCH_ADD': {
      const newSubAgents = new Map(state.agents.subAgents)
      newSubAgents.set(action.parentId, action.subAgents)
      return {
        ...state,
        agents: { ...state.agents, subAgents: newSubAgents },
      }
    }

    case 'SUBAGENT_UPDATE_STATUS': {
      const newSubAgents = new Map(state.agents.subAgents)
      const subs = newSubAgents.get(action.parentId)
      if (subs) {
        newSubAgents.set(
          action.parentId,
          subs.map((s) =>
            s.id === action.subAgentId ? { ...s, status: action.status } : s
          )
        )
      }
      return {
        ...state,
        agents: { ...state.agents, subAgents: newSubAgents },
      }
    }

    case 'SUBAGENT_SELECT':
      return {
        ...state,
        agents: {
          ...state.agents,
          selectedSubAgentId: action.subAgentId,
        },
      }

    case 'SUBAGENT_CLEAR': {
      const newSubAgents = new Map(state.agents.subAgents)
      newSubAgents.delete(action.parentId)
      return {
        ...state,
        agents: { ...state.agents, subAgents: newSubAgents },
      }
    }

    // UI
    case 'UI_TOGGLE_TIMELINE':
      return {
        ...state,
        ui: { ...state.ui, timelineCollapsed: !state.ui.timelineCollapsed },
      }

    case 'UI_SET_SCROLL':
      return {
        ...state,
        ui: { ...state.ui, scrollOffset: action.offset },
      }

    case 'UI_SET_VISIBLE_COUNT':
      return {
        ...state,
        ui: { ...state.ui, visibleItemCount: action.count },
      }

    case 'UI_SET_TERMINAL_SIZE':
      return {
        ...state,
        ui: { ...state.ui, terminalWidth: action.width, terminalHeight: action.height },
      }

    case 'UI_SET_THEME':
      return {
        ...state,
        ui: { ...state.ui, theme: action.theme },
      }

    // Modals
    case 'MODAL_OPEN_LOG_VIEWER':
      return {
        ...state,
        modals: { ...state.modals, logViewerOpen: true, logViewerAgentId: action.agentId },
      }

    case 'MODAL_CLOSE_LOG_VIEWER':
      return {
        ...state,
        modals: { ...state.modals, logViewerOpen: false, logViewerAgentId: null },
      }

    case 'MODAL_OPEN_HISTORY':
      return { ...state, modals: { ...state.modals, historyViewOpen: true } }

    case 'MODAL_CLOSE_HISTORY':
      return { ...state, modals: { ...state.modals, historyViewOpen: false } }

    case 'MODAL_OPEN_STOP_CONFIRM':
      return { ...state, modals: { ...state.modals, stopConfirmOpen: true } }

    case 'MODAL_CLOSE_STOP_CONFIRM':
      return { ...state, modals: { ...state.modals, stopConfirmOpen: false } }

    case 'MODAL_OPEN_ERROR':
      return {
        ...state,
        modals: { ...state.modals, errorModalOpen: true, errorMessage: action.message },
      }

    case 'MODAL_CLOSE_ERROR':
      return {
        ...state,
        modals: { ...state.modals, errorModalOpen: false, errorMessage: null },
      }

    case 'MODAL_OPEN_CHECKPOINT':
      return {
        ...state,
        modals: { ...state.modals, checkpointModalOpen: true, checkpointMessage: action.message },
      }

    case 'MODAL_CLOSE_CHECKPOINT':
      return {
        ...state,
        modals: { ...state.modals, checkpointModalOpen: false, checkpointMessage: null },
      }

    // Input
    case 'INPUT_SET_WAITING':
      return {
        ...state,
        input: { ...state.input, isWaiting: action.isWaiting, prompt: action.prompt ?? null },
      }

    case 'INPUT_SET_CHAINED':
      return {
        ...state,
        input: { ...state.input, chainedPrompts: action.prompts, currentChainIndex: 0 },
      }

    case 'INPUT_ADVANCE_CHAIN':
      return {
        ...state,
        input: { ...state.input, currentChainIndex: state.input.currentChainIndex + 1 },
      }

    case 'INPUT_CLEAR':
      return { ...state, input: initialInputState }

    // Batch
    case 'BATCH':
      return action.actions.reduce(reducer, state)

    default:
      return state
  }
}

// ============================================================================
// Store Implementation
// ============================================================================

export interface Store {
  getState: () => AppState
  dispatch: (action: Action) => void
  subscribe: (listener: (state: AppState) => void) => Unsubscribe
  select: <T>(selector: (state: AppState) => T) => () => T
}

export function createStore(initialStateOverride?: Partial<AppState>): Store {
  const [state, setState] = createSignal<AppState>({
    ...initialState,
    ...initialStateOverride,
  })

  const listeners = new Set<(state: AppState) => void>()
  let batchTimeout: NodeJS.Timeout | null = null
  const pendingActions: Action[] = []

  const dispatch = (action: Action): void => {
    pendingActions.push(action)

    // Batch updates within the same frame
    if (!batchTimeout) {
      batchTimeout = setTimeout(() => {
        batchTimeout = null

        if (pendingActions.length > 0) {
          batch(() => {
            const newState = pendingActions.reduce(reducer, state())
            setState(newState)
            pendingActions.length = 0

            // Notify listeners
            for (const listener of listeners) {
              try {
                listener(newState)
              } catch (error) {
                console.error('[Store] Listener error:', error)
              }
            }
          })
        }
      }, 0)
    }
  }

  const subscribe = (listener: (state: AppState) => void): Unsubscribe => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const select = <T>(selector: (state: AppState) => T): (() => T) => {
    return createMemo(() => selector(state()))
  }

  return {
    getState: state,
    dispatch,
    subscribe,
    select,
  }
}

// ============================================================================
// Selectors
// ============================================================================

export const selectors = {
  // Workflow selectors
  workflowStatus: (state: AppState) => state.workflow.status,
  workflowMode: (state: AppState) => state.workflow.mode,
  workflowProgress: (state: AppState) => ({
    current: state.workflow.currentStepIndex,
    total: state.workflow.totalSteps,
    percentage:
      state.workflow.totalSteps > 0
        ? Math.round((state.workflow.currentStepIndex / state.workflow.totalSteps) * 100)
        : 0,
  }),

  // Agent selectors
  allAgents: (state: AppState) => state.agents.agents,
  selectedAgent: (state: AppState) =>
    state.agents.agents.find((a) => a.id === state.agents.selectedAgentId),
  agentById: (id: AgentId) => (state: AppState) =>
    state.agents.agents.find((a) => a.id === id),
  visibleAgents: (state: AppState) =>
    state.agents.agents.slice(
      state.ui.scrollOffset,
      state.ui.scrollOffset + state.ui.visibleItemCount
    ),

  // SubAgent selectors
  subAgentsForAgent: (parentId: AgentId) => (state: AppState) =>
    state.agents.subAgents.get(parentId) ?? [],

  // UI selectors
  isTimelineCollapsed: (state: AppState) => state.ui.timelineCollapsed,
  terminalSize: (state: AppState) => ({
    width: state.ui.terminalWidth,
    height: state.ui.terminalHeight,
  }),

  // Modal selectors
  anyModalOpen: (state: AppState) =>
    state.modals.logViewerOpen ||
    state.modals.historyViewOpen ||
    state.modals.stopConfirmOpen ||
    state.modals.errorModalOpen ||
    state.modals.checkpointModalOpen,

  // Input selectors
  inputState: (state: AppState) => state.input,
  isWaitingForInput: (state: AppState) => state.input.isWaiting,
}

// ============================================================================
// Global Store Instance
// ============================================================================

let globalStore: Store | null = null

export const getStore = (): Store => {
  if (!globalStore) {
    globalStore = createStore()
  }
  return globalStore
}

export const resetStore = (initialStateOverride?: Partial<AppState>): Store => {
  globalStore = createStore(initialStateOverride)
  return globalStore
}
