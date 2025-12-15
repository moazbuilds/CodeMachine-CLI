/**
 * UI State Types
 */

import type {
  WorkflowState,
  AgentStatus,
  LoopState,
  ChainedState,
  InputState,
  SubAgentState,
  TriggeredAgentState,
  WorkflowStatus,
} from "../../state/types"

export type Listener = () => void

export type UIActions = {
  getState(): WorkflowState
  subscribe(fn: Listener): () => void
  addAgent(agent: WorkflowState["agents"][number]): void
  updateAgentStatus(agentId: string, status: AgentStatus): void
  updateAgentEngine(agentId: string, engine: string): void
  updateAgentModel(agentId: string, model: string): void
  updateAgentTelemetry(agentId: string, telemetry: Partial<WorkflowState["agents"][number]["telemetry"]>): void
  setLoopState(loopState: LoopState | null): void
  clearLoopRound(agentId: string): void
  addSubAgent(parentId: string, subAgent: SubAgentState): void
  batchAddSubAgents(parentId: string, subAgents: SubAgentState[]): void
  updateSubAgentStatus(subAgentId: string, status: AgentStatus): void
  clearSubAgents(parentId: string): void
  navigateDown(visibleItemCount?: number): void
  navigateUp(visibleItemCount?: number): void
  selectItem(itemId: string, itemType: "main" | "summary" | "sub", visibleItemCount?: number, immediate?: boolean): void
  toggleExpand(agentId: string): void
  toggleTimeline(): void
  setVisibleItemCount(count: number): void
  setScrollOffset(offset: number, visibleItemCount?: number): void
  setWorkflowStatus(status: WorkflowStatus): void
  setCheckpointState(checkpoint: { active: boolean; reason?: string } | null): void
  setInputState(inputState: InputState | null): void
  /** @deprecated Use setInputState instead */
  setChainedState(chainedState: ChainedState | null): void
  registerMonitoringId(uiAgentId: string, monitoringId: number): void
  addTriggeredAgent(sourceAgentId: string, triggeredAgent: TriggeredAgentState): void
  resetAgentForLoop(agentId: string, cycleNumber?: number): void
  addUIElement(element: { id: string; text: string; stepIndex: number }): void
  logMessage(agentId: string, message: string): void
  setAutonomousMode(enabled: boolean): void
}

export type { WorkflowState, AgentStatus, LoopState, ChainedState, InputState, SubAgentState, TriggeredAgentState, WorkflowStatus }
