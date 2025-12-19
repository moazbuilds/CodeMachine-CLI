/**
 * Workflow Feature Types
 */

/**
 * Agent display information
 */
export interface AgentDisplayInfo {
  /** Agent ID */
  id: string
  /** Display name */
  name: string
  /** Current status */
  status: AgentDisplayStatus
  /** Whether this is the main agent */
  isMain: boolean
  /** Duration in seconds */
  duration?: number
  /** Cost in dollars */
  cost?: number
  /** Token count */
  tokens?: number
}

/**
 * Agent display status
 */
export type AgentDisplayStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'waiting'

/**
 * Sub-agent display information
 */
export interface SubAgentDisplayInfo {
  /** Sub-agent ID */
  id: string
  /** Parent agent ID */
  parentId: string
  /** Display name */
  name: string
  /** Description */
  description?: string
  /** Status */
  status: AgentDisplayStatus
}

/**
 * Timeline item for display
 */
export interface TimelineItem {
  /** Unique ID */
  id: string
  /** Item type */
  type: 'agent' | 'subagent' | 'checkpoint' | 'loop'
  /** Display label */
  label: string
  /** Whether this item is selected */
  selected: boolean
  /** Whether this item is expanded */
  expanded: boolean
  /** Child items */
  children?: TimelineItem[]
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Output line for display
 */
export interface OutputLine {
  /** Line ID */
  id: string
  /** Line content */
  content: string
  /** Line type for styling */
  type: 'text' | 'prompt' | 'command' | 'error' | 'system'
  /** Timestamp */
  timestamp?: number
}

/**
 * Workflow display mode
 */
export type WorkflowMode = 'manual' | 'autopilot'

/**
 * Panel visibility state
 */
export interface PanelState {
  /** Whether timeline panel is visible */
  timelineVisible: boolean
  /** Whether output panel is visible */
  outputVisible: boolean
  /** Currently active panel */
  activePanel: 'timeline' | 'output'
}

/**
 * Modal visibility state
 */
export interface WorkflowModals {
  /** Stop confirmation modal */
  stopModal: boolean
  /** Error modal */
  errorModal: boolean
  /** History modal */
  historyModal: boolean
  /** Log viewer modal */
  logViewerModal: boolean
  /** Checkpoint modal */
  checkpointModal: boolean
}

/**
 * Workflow screen state
 */
export interface WorkflowScreenState {
  /** Current mode */
  mode: WorkflowMode
  /** Panel state */
  panels: PanelState
  /** Modal state */
  modals: WorkflowModals
  /** Timeline items */
  timelineItems: TimelineItem[]
  /** Selected timeline item */
  selectedTimelineItem: string | null
  /** Output lines */
  outputLines: OutputLine[]
  /** Whether input is active */
  inputActive: boolean
  /** Current input value */
  inputValue: string
}

/**
 * Workflow screen actions
 */
export interface WorkflowScreenActions {
  /** Toggle mode (manual/autopilot) */
  toggleMode: () => void
  /** Toggle timeline panel */
  toggleTimeline: () => void
  /** Toggle output panel */
  toggleOutput: () => void
  /** Switch active panel */
  switchPanel: (panel: 'timeline' | 'output') => void
  /** Select timeline item */
  selectTimelineItem: (id: string) => void
  /** Expand/collapse timeline item */
  toggleTimelineItem: (id: string) => void
  /** Open modal */
  openModal: (modal: keyof WorkflowModals) => void
  /** Close modal */
  closeModal: (modal: keyof WorkflowModals) => void
  /** Submit input */
  submitInput: () => void
  /** Skip current step */
  skipStep: () => void
  /** Stop workflow */
  stopWorkflow: () => void
  /** Pause workflow */
  pauseWorkflow: () => void
  /** Resume workflow */
  resumeWorkflow: () => void
}
