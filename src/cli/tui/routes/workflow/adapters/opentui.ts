/**
 * OpenTUI Adapter
 *
 * Subscribes to the workflow event bus and updates the TUI state.
 * This adapter bridges the workflow execution events to the OpenTUI/SolidJS UI.
 */

import type { WorkflowEvent } from "../../../../../workflows/events/index.js"
import { debug } from "../../../../../shared/logging/logger.js"
import type { AgentStatus, SubAgentState, LoopState, ChainedState, InputState, TriggeredAgentState } from "../state/types.js"
import { BaseUIAdapter } from "./base.js"
import type { UIAdapterOptions } from "./types.js"
import { timerService } from "@tui/shared/services"

/**
 * Actions interface that the OpenTUI adapter calls to update UI state.
 * This matches the UIActions from ui-state context.
 */
export interface UIActions {
  addAgent(agent: {
    id: string
    name: string
    engine: string
    model?: string
    status: AgentStatus
    telemetry: { tokensIn: number; tokensOut: number; cached?: number; cost?: number }
    startTime: number
    toolCount: number
    thinkingCount: number
    stepIndex?: number
    totalSteps?: number
  }): void
  updateAgentStatus(agentId: string, status: AgentStatus): void
  updateAgentEngine(agentId: string, engine: string): void
  updateAgentModel(agentId: string, model: string): void
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
  setWorkflowStatus(status: "running" | "stopping" | "completed" | "stopped" | "awaiting" | "paused" | "error"): void
  setCheckpointState(checkpoint: { active: boolean; reason?: string } | null): void
  setInputState(inputState: InputState | null): void
  /** @deprecated Use setInputState instead */
  setChainedState(chainedState: ChainedState | null): void
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
        // Reset timer for new workflow (will auto-start on first agent)
        timerService.reset()
        this.actions.setWorkflowStatus("running")
        break

      case "workflow:status":
        debug(`[DEBUG Adapter] Received workflow:status event with status=${event.status}`)
        // Handle timer service state transitions
        if (event.status === "stopped" || event.status === "completed" || event.status === "error") {
          timerService.stop()
        } else if (event.status === "paused") {
          timerService.pause("user")
        } else if (event.status === "running" && timerService.isPaused()) {
          timerService.resume()
        }
        this.actions.setWorkflowStatus(event.status)
        break

      case "workflow:stopped":
        timerService.stop()
        this.actions.setWorkflowStatus("stopped")
        break

      // Agent events
      case "agent:added": {
        const startTime = Date.now()
        // Register with timer service (auto-starts workflow timer on first agent)
        timerService.registerAgent(event.agent.id, startTime)
        this.actions.addAgent({
          id: event.agent.id,
          name: event.agent.name,
          engine: event.agent.engine,
          model: event.agent.model,
          status: event.agent.status,
          telemetry: { tokensIn: 0, tokensOut: 0 },
          startTime,
          toolCount: 0,
          thinkingCount: 0,
          stepIndex: event.agent.stepIndex,
          totalSteps: event.agent.totalSteps,
        })
        break
      }

      case "agent:status":
        // Update timer service for completion states
        if (event.status === "completed" || event.status === "failed" || event.status === "skipped") {
          timerService.completeAgent(event.agentId)
        }
        this.actions.updateAgentStatus(event.agentId, event.status)
        break

      case "agent:engine":
        this.actions.updateAgentEngine(event.agentId, event.engine)
        break

      case "agent:model":
        this.actions.updateAgentModel(event.agentId, event.model)
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
        // Register sub-agent with timer service
        timerService.registerAgent(event.subAgent.id, event.subAgent.startTime)
        this.actions.addSubAgent(event.parentId, event.subAgent)
        break

      case "subagent:batch":
        // Register all sub-agents with timer service
        for (const subAgent of event.subAgents) {
          timerService.registerAgent(subAgent.id, subAgent.startTime)
        }
        this.actions.batchAddSubAgents(event.parentId, event.subAgents)
        break

      case "subagent:status":
        // Update timer service for completion states
        if (event.status === "completed" || event.status === "failed" || event.status === "skipped") {
          timerService.completeAgent(event.subAgentId)
        }
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
        if (event.checkpoint?.active) {
          timerService.pause("checkpoint")
        }
        this.actions.setCheckpointState(event.checkpoint)
        break

      case "checkpoint:clear":
        // Resume timer if not in another pause state
        if (timerService.getPauseReason() === "checkpoint") {
          timerService.resume()
        }
        this.actions.setCheckpointState(null)
        break

      // Input state events (unified pause/chained)
      case "input:state":
        if (event.inputState?.active) {
          timerService.pause("awaiting")
        } else if (timerService.getPauseReason() === "awaiting") {
          timerService.resume()
        }
        this.actions.setInputState(event.inputState)
        break

      // Chained prompts events (deprecated - use input:state)
      case "chained:state":
        this.actions.setChainedState(event.chainedState)
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
