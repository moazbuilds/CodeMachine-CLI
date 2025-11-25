import type { RGBA } from "@opentui/core"

export type AgentStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "retrying"

export interface AgentTelemetry {
  tokensIn: number
  tokensOut: number
  cached?: number
  cost?: number
  duration?: number
}

export interface AgentState {
  id: string
  name: string
  engine: string
  status: AgentStatus
  telemetry: AgentTelemetry
  startTime: number
  endTime?: number
  error?: string
  toolCount: number
  thinkingCount: number
  loopRound?: number
  loopReason?: string
  stepIndex?: number
  totalSteps?: number
  monitoringId?: number // Maps to AgentMonitorService registry ID for log file access
}

export interface SubAgentState extends AgentState {
  parentId: string
}

export interface TriggeredAgentState extends AgentState {
  triggeredBy: string
  triggerCondition?: string
}

export interface LoopState {
  active: boolean
  sourceAgent: string
  backSteps: number
  iteration: number
  maxIterations: number
  skipList: string[]
  reason?: string
}

export type WorkflowStatus = "running" | "stopping" | "completed" | "stopped" | "checkpoint"

export interface CheckpointState {
  active: boolean
  reason?: string
}

export interface ExecutionRecord {
  id: string
  agentName: string
  agentId: string
  cycleNumber?: number
  engine: string
  status: AgentStatus
  startTime: number
  endTime?: number
  duration?: number
  telemetry: AgentTelemetry
  toolCount: number
  thinkingCount: number
  error?: string
}

export interface UIElement {
  id: string
  text: string
  stepIndex: number
}

export interface WorkflowState {
  workflowName: string
  version: string
  packageName: string
  startTime: number
  endTime?: number
  agents: AgentState[]
  subAgents: Map<string, SubAgentState[]>
  triggeredAgents: TriggeredAgentState[]
  uiElements: UIElement[]
  executionHistory: ExecutionRecord[]
  loopState: LoopState | null
  checkpointState: CheckpointState | null
  expandedNodes: Set<string>
  showTelemetryView: boolean
  selectedAgentId: string | null
  selectedSubAgentId: string | null
  selectedItemType: "main" | "summary" | "sub" | null
  visibleItemCount: number
  scrollOffset: number
  totalSteps: number
  workflowStatus: WorkflowStatus
  agentIdMapVersion: number
}

export type ThemeLike = {
  primary: RGBA
  text: RGBA
  textMuted: RGBA
  border: RGBA
  borderSubtle: RGBA
  background: RGBA
  backgroundPanel: RGBA
  backgroundElement: RGBA
}
