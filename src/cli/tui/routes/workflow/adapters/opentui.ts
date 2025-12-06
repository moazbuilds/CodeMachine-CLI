/**
 * OpenTUI Adapter
 *
 * Subscribes to the workflow event bus and updates the TUI state.
 * This adapter bridges the workflow execution events to the OpenTUI/SolidJS UI.
 */

import type { WorkflowEvent } from "../../../../../workflows/events/index.js"
import type { AgentStatus, SubAgentState, LoopState, TriggeredAgentState } from "../state/types.js"
import { BaseUIAdapter } from "./base.js"
import type { UIAdapterOptions } from "./types.js"

/**
 * Actions interface that the OpenTUI adapter calls to update UI state.
 * This matches the UIActions from ui-state context.
 */
export interface UIActions {
  addAgent(agent: {
    id: string
    name: string
    engine: string
    status: AgentStatus
    telemetry: { tokensIn: number; tokensOut: number; cached?: number; cost?: number }
    startTime: number
    toolCount: number
    thinkingCount: number
    stepIndex?: number
    totalSteps?: number
  }): void
  updateAgentStatus(agentId: string, status: AgentStatus): void
  updateAgentTelemetry(
    agentId: string,
    telemetry: { tokensIn?: number; tokensOut?: number; cached?: number; cost?: number }
  ): void
  setLoopState(loopState: LoopState | null): void
  clearLoopRound(agentId: string): void
  addSubAgent(parentId: string, subAgent: SubAgentState): void
  batchAddSubAgents(parentId: string, subAgents: SubAgentState[]): void
  updateSubAgentStatus(subAgentId: string, status: AgentStatus): void
  clearSubAgents(parentId: string): void
  setWorkflowStatus(status: "running" | "stopping" | "completed" | "stopped" | "checkpoint" | "paused"): void
  setCheckpointState(checkpoint: { active: boolean; reason?: string } | null): void
  registerMonitoringId(uiAgentId: string, monitoringId: number): void
  addTriggeredAgent(sourceAgentId: string, triggeredAgent: TriggeredAgentState): void
  resetAgentForLoop(agentId: string, cycleNumber?: number): void
  addUIElement(element: { id: string; text: string; stepIndex: number }): void
  logMessage(agentId: string, message: string): void
}

export interface OpenTUIAdapterOptions extends UIAdapterOptions {
  actions: UIActions
}

/**
 * OpenTUI Adapter
 *
 * Listens to workflow events and translates them into UI state updates.
 */
export class OpenTUIAdapter extends BaseUIAdapter {
  private actions: UIActions

  constructor(options: OpenTUIAdapterOptions) {
    super(options)
    this.actions = options.actions
  }

  /**
   * Called when UI starts
   */
  protected onStart(): void {
    // OpenTUI handles its own rendering lifecycle
  }

  /**
   * Called when UI stops
   */
  protected onStop(): void {
    // OpenTUI handles its own cleanup
  }

  /**
   * Handle incoming workflow events
   */
  protected handleEvent(event: WorkflowEvent): void {
    switch (event.type) {
      // Workflow events
      case "workflow:started":
        this.actions.setWorkflowStatus("running")
        break

      case "workflow:status":
        this.actions.setWorkflowStatus(event.status)
        break

      case "workflow:stopped":
        this.actions.setWorkflowStatus("stopped")
        break

      // Agent events
      case "agent:added":
        this.actions.addAgent({
          id: event.agent.id,
          name: event.agent.name,
          engine: event.agent.engine,
          status: event.agent.status,
          telemetry: { tokensIn: 0, tokensOut: 0 },
          startTime: Date.now(),
          toolCount: 0,
          thinkingCount: 0,
          stepIndex: event.agent.stepIndex,
          totalSteps: event.agent.totalSteps,
        })
        break

      case "agent:status":
        this.actions.updateAgentStatus(event.agentId, event.status)
        break

      case "agent:telemetry":
        this.actions.updateAgentTelemetry(event.agentId, {
          tokensIn: event.telemetry.tokensIn,
          tokensOut: event.telemetry.tokensOut,
          cached: event.telemetry.cached,
          cost: event.telemetry.cost,
        })
        break

      case "agent:reset":
        this.actions.resetAgentForLoop(event.agentId, event.cycleNumber)
        break

      // Sub-agent events
      case "subagent:added":
        this.actions.addSubAgent(event.parentId, event.subAgent)
        break

      case "subagent:batch":
        this.actions.batchAddSubAgents(event.parentId, event.subAgents)
        break

      case "subagent:status":
        this.actions.updateSubAgentStatus(event.subAgentId, event.status)
        break

      case "subagent:clear":
        this.actions.clearSubAgents(event.parentId)
        break

      // Triggered agent events
      case "triggered:added":
        this.actions.addTriggeredAgent(event.sourceAgentId, event.triggeredAgent)
        break

      // Loop events
      case "loop:state":
        this.actions.setLoopState(event.loopState)
        break

      case "loop:clear":
        this.actions.clearLoopRound(event.agentId)
        break

      // Checkpoint events
      case "checkpoint:state":
        this.actions.setCheckpointState(event.checkpoint)
        break

      case "checkpoint:clear":
        this.actions.setCheckpointState(null)
        break

      // Message/logging events
      case "message:log":
        this.actions.logMessage(event.agentId, event.message)
        break

      // UI element events
      case "ui:element":
        this.actions.addUIElement(event.element)
        break

      // Monitoring registration
      case "monitoring:register":
        this.actions.registerMonitoringId(event.uiAgentId, event.monitoringId)
        break
    }
  }
}

/**
 * Create an OpenTUI adapter instance
 */
export function createOpenTUIAdapter(actions: UIActions): OpenTUIAdapter {
  return new OpenTUIAdapter({ actions })
}
