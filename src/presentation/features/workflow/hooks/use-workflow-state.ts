/**
 * Use Workflow State Hook
 *
 * Manages state for the workflow screen.
 */

import { createSignal, createMemo } from 'solid-js'
import type {
  WorkflowScreenState,
  WorkflowScreenActions,
  WorkflowMode,
  PanelState,
  WorkflowModals,
  TimelineItem,
  OutputLine,
} from '../types'

/**
 * Options for workflow state hook
 */
export interface UseWorkflowStateOptions {
  /** Initial mode */
  initialMode?: WorkflowMode
  /** Called when mode changes */
  onModeChange?: (mode: WorkflowMode) => void
  /** Called when skip is requested */
  onSkip?: () => void
  /** Called when stop is requested */
  onStop?: () => void
  /** Called when pause is requested */
  onPause?: () => void
  /** Called when resume is requested */
  onResume?: () => void
  /** Called when input is submitted */
  onInputSubmit?: (value: string) => void
}

/**
 * Workflow state and actions
 */
export interface UseWorkflowStateResult {
  /** Current state */
  state: WorkflowScreenState
  /** Actions to modify state */
  actions: WorkflowScreenActions
}

/**
 * Create workflow screen state
 *
 * @example
 * ```typescript
 * const { state, actions } = useWorkflowState({
 *   initialMode: 'manual',
 *   onModeChange: (mode) => workflowService.setMode(mode),
 *   onSkip: () => workflowService.skip(),
 * })
 * ```
 */
export function useWorkflowState(
  options: UseWorkflowStateOptions = {}
): UseWorkflowStateResult {
  // Mode
  const [mode, setMode] = createSignal<WorkflowMode>(options.initialMode ?? 'manual')

  // Panels
  const [panels, setPanels] = createSignal<PanelState>({
    timelineVisible: true,
    outputVisible: true,
    activePanel: 'output',
  })

  // Modals
  const [modals, setModals] = createSignal<WorkflowModals>({
    stopModal: false,
    errorModal: false,
    historyModal: false,
    logViewerModal: false,
    checkpointModal: false,
  })

  // Timeline
  const [timelineItems, setTimelineItems] = createSignal<TimelineItem[]>([])
  const [selectedTimelineItem, setSelectedTimelineItem] = createSignal<string | null>(
    null
  )

  // Output
  const [outputLines, setOutputLines] = createSignal<OutputLine[]>([])

  // Input
  const [inputActive, setInputActive] = createSignal(false)
  const [inputValue, setInputValue] = createSignal('')

  // Computed state
  const state: WorkflowScreenState = {
    get mode() {
      return mode()
    },
    get panels() {
      return panels()
    },
    get modals() {
      return modals()
    },
    get timelineItems() {
      return timelineItems()
    },
    get selectedTimelineItem() {
      return selectedTimelineItem()
    },
    get outputLines() {
      return outputLines()
    },
    get inputActive() {
      return inputActive()
    },
    get inputValue() {
      return inputValue()
    },
  }

  // Actions
  const actions: WorkflowScreenActions = {
    toggleMode: () => {
      const newMode = mode() === 'manual' ? 'autopilot' : 'manual'
      setMode(newMode)
      options.onModeChange?.(newMode)
    },

    toggleTimeline: () => {
      setPanels((prev) => ({
        ...prev,
        timelineVisible: !prev.timelineVisible,
      }))
    },

    toggleOutput: () => {
      setPanels((prev) => ({
        ...prev,
        outputVisible: !prev.outputVisible,
      }))
    },

    switchPanel: (panel) => {
      setPanels((prev) => ({
        ...prev,
        activePanel: panel,
      }))
    },

    selectTimelineItem: (id) => {
      setSelectedTimelineItem(id)
    },

    toggleTimelineItem: (id) => {
      setTimelineItems((items) =>
        items.map((item) =>
          item.id === id ? { ...item, expanded: !item.expanded } : item
        )
      )
    },

    openModal: (modal) => {
      setModals((prev) => ({
        ...prev,
        [modal]: true,
      }))
    },

    closeModal: (modal) => {
      setModals((prev) => ({
        ...prev,
        [modal]: false,
      }))
    },

    submitInput: () => {
      const value = inputValue().trim()
      if (value) {
        options.onInputSubmit?.(value)
        setInputValue('')
      }
    },

    skipStep: () => {
      options.onSkip?.()
    },

    stopWorkflow: () => {
      actions.closeModal('stopModal')
      options.onStop?.()
    },

    pauseWorkflow: () => {
      options.onPause?.()
    },

    resumeWorkflow: () => {
      options.onResume?.()
    },
  }

  return { state, actions }
}
