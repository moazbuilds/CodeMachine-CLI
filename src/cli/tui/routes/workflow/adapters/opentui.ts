/**
 * OpenTUI Adapter
 *
 * Subscribes to the workflow event bus and updates the TUI state.
 * This adapter bridges the workflow execution events to the OpenTUI/SolidJS UI.
 */

import type { WorkflowEvent } from "../../../../../workflows/events/index.js"
import { debug } from "../../../../../shared/logging/logger.js"
import type { AgentStatus, SubAgentState, LoopState, ChainedState, InputState, TriggeredAgentState, ControllerState, WorkflowState, WorkflowView } from "../state/types.js"
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
    orderIndex?: number
  }): void
  updateAgentStatus(agentId: string, status: AgentStatus): void
  updateAgentStartTime(agentId: string, startTime: number): void
  updateAgentDuration(agentId: string, duration: number): void
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
  updateSubAgentStartTime(subAgentId: string, startTime: number): void
  updateSubAgentDuration(subAgentId: string, duration: number): void
  clearSubAgents(parentId: string): void
  setWorkflowName(name: string): void
  setWorkflowStatus(status: "running" | "stopping" | "completed" | "stopped" | "awaiting" | "paused" | "error"): void
  setCheckpointState(checkpoint: { active: boolean; reason?: string } | null): void
  setInputState(inputState: InputState | null): void
  /** @deprecated Use setInputState instead */
  setChainedState(chainedState: ChainedState | null): void
  registerMonitoringId(uiAgentId: string, monitoringId: number): void
  addTriggeredAgent(sourceAgentId: string, triggeredAgent: TriggeredAgentState): void
  resetAgentForLoop(agentId: string, cycleNumber?: number): void
  addSeparator(separator: { id: string; text: string; stepIndex: number }): void
  logMessage(agentId: string, message: string): void
  showToast?(variant: "success" | "error" | "info" | "warning", message: string): void
  getState(): WorkflowState
  setControllerState(controllerState: ControllerState | null): void
  updateControllerTelemetry(telemetry: { tokensIn?: number; tokensOut?: number; cached?: number; cost?: number }): void
  updateControllerStatus(status: AgentStatus): void
  updateControllerMonitoring(monitoringId: number): void
  setWorkflowView(view: WorkflowView): void
  /** Reset state for a new workflow */
  reset(workflowName: string): void
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
        // Reset state for new workflow - ensures clean slate
        debug('[ADAPTER] workflow:started - resetting state for: %s', event.workflowName)
        this.actions.reset(event.workflowName)
        // Only reset timer if not already running (controller may have started it)
        if (!timerService.isRunning()) {
          timerService.reset()
        }
        this.actions.setWorkflowName(event.workflowName)
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

      case "workflow:view":
        debug('[ADAPTER] workflow:view → view=%s', event.view)
        this.actions.setWorkflowView(event.view)
        break

      // Agent events
      case "agent:added": {
        // Register with timer if starting as running or delegated
        if (event.agent.status === "running" || event.agent.status === "delegated") {
          timerService.registerAgent(event.agent.id)
        }
        this.actions.addAgent({
          id: event.agent.id,
          name: event.agent.name,
          engine: event.agent.engine,
          model: event.agent.model,
          status: event.agent.status,
          telemetry: { tokensIn: 0, tokensOut: 0 },
          startTime: (event.agent.status === "running" || event.agent.status === "delegated") ? Date.now() : 0,
          toolCount: 0,
          thinkingCount: 0,
          stepIndex: event.agent.stepIndex,
          totalSteps: event.agent.totalSteps,
          orderIndex: event.agent.orderIndex,
        })
        break
      }

      case "agent:status":
        // Register when starting to run or delegated (only on first event, not on resume)
        if ((event.status === "running" || event.status === "delegated") && !timerService.hasAgent(event.agentId)) {
          timerService.registerAgent(event.agentId)
          this.actions.updateAgentStartTime(event.agentId, Date.now())
        }
        // Complete and store duration when done (only if agent was being tracked)
        // Skip if agent not in timer - this happens when completed is emitted after a loop reset
        if (event.status === "completed" || event.status === "failed" || event.status === "skipped") {
          if (timerService.hasAgent(event.agentId)) {
            const duration = timerService.completeAgent(event.agentId)
            this.actions.updateAgentDuration(event.agentId, duration)
          }
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
        debug('[TELEMETRY:4-ADAPTER] [STEP-AGENT] Received agent:telemetry → agentId=%s, tokensIn=%s, tokensOut=%s, cached=%s',
          event.agentId, event.telemetry.tokensIn, event.telemetry.tokensOut, event.telemetry.cached)
        this.actions.updateAgentTelemetry(event.agentId, {
          tokensIn: event.telemetry.tokensIn,
          tokensOut: event.telemetry.tokensOut,
          cached: event.telemetry.cached,
          cost: event.telemetry.cost,
        })
        break

      case "agent:reset":
        // Clear agent from timer if still tracked, allowing fresh registration on next run
        if (timerService.hasAgent(event.agentId)) {
          timerService.completeAgent(event.agentId)
        }
        this.actions.resetAgentForLoop(event.agentId, event.cycleNumber)
        break

      // Controller agent events
      case "controller:info": {
        // Preserve existing telemetry when controller info is updated (controller runs multiple times)
        const existingController = this.actions.getState().controllerState
        this.actions.setControllerState({
          id: event.id,
          name: event.name,
          engine: event.engine,
          model: event.model,
          telemetry: existingController?.telemetry ?? { tokensIn: 0, tokensOut: 0 },
        })
        break
      }

      case "controller:engine":
        {
          const currentController = this.actions.getState().controllerState
          if (currentController) {
            this.actions.setControllerState({ ...currentController, engine: event.engine })
          }
        }
        break

      case "controller:model":
        {
          const currentController = this.actions.getState().controllerState
          if (currentController) {
            this.actions.setControllerState({ ...currentController, model: event.model })
          }
        }
        break

      case "controller:telemetry":
        debug('[TELEMETRY:4-ADAPTER] [CONTROLLER] Received controller:telemetry → tokensIn=%s, tokensOut=%s, cached=%s',
          event.telemetry.tokensIn, event.telemetry.tokensOut, event.telemetry.cached)
        this.actions.updateControllerTelemetry({
          tokensIn: event.telemetry.tokensIn,
          tokensOut: event.telemetry.tokensOut,
          cached: event.telemetry.cached,
          cost: event.telemetry.cost,
        })
        break

      case "controller:status":
        debug('[ADAPTER] controller:status → status=%s', event.status)
        // Start workflow timer when controller starts running
        if (event.status === "running") {
          timerService.start()
        }
        this.actions.updateControllerStatus(event.status)
        break

      case "controller:monitoring":
        debug('[ADAPTER] controller:monitoring → monitoringId=%d', event.monitoringId)
        this.actions.updateControllerMonitoring(event.monitoringId)
        break

      // Sub-agent events
      case "subagent:added":
        // Register if starting as running
        if (event.subAgent.status === "running") {
          timerService.registerAgent(event.subAgent.id)
        }
        this.actions.addSubAgent(event.parentId, event.subAgent)
        break

      case "subagent:batch":
        // Register running sub-agents
        for (const subAgent of event.subAgents) {
          if (subAgent.status === "running") {
            timerService.registerAgent(subAgent.id)
          }
        }
        this.actions.batchAddSubAgents(event.parentId, event.subAgents)
        break

      case "subagent:status":
        // Register when starting to run (only on first running event, not on resume)
        if (event.status === "running" && !timerService.hasAgent(event.subAgentId)) {
          timerService.registerAgent(event.subAgentId)
          this.actions.updateSubAgentStartTime(event.subAgentId, Date.now())
        }
        // Complete and store duration when done (only if sub-agent was being tracked)
        if (event.status === "completed" || event.status === "failed" || event.status === "skipped") {
          if (timerService.hasAgent(event.subAgentId)) {
            const duration = timerService.completeAgent(event.subAgentId)
            this.actions.updateSubAgentDuration(event.subAgentId, duration)
          }
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

      // Message/logging events - show as toast
      case "message:log":
        this.actions.showToast?.("warning", event.message)
        break

      // Separator events (visual dividers)
      case "separator:add":
        this.actions.addSeparator(event.separator)
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
