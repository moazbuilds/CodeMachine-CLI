/**
 * Workflow Event Emitter
 *
 * A helper class that provides WorkflowUIManager-like methods
 * but emits events to the event bus instead of directly manipulating UI.
 *
 * This makes it easy to integrate with existing workflow code:
 * - Old code: ui.addMainAgent(...)
 * - New code: emitter.addMainAgent(...) // emits event
 */

import type { WorkflowEventBus } from './event-bus.js';
import type {
  AgentInfo,
  UIElementInfo,
  WorkflowEvent,
} from './types.js';
import type {
  AgentStatus,
  AgentTelemetry,
  LoopState,
  CheckpointState,
  WorkflowStatus,
  SubAgentState,
  TriggeredAgentState,
} from '../../cli/tui/routes/workflow/state/types.js';

/**
 * WorkflowEventEmitter - Emits workflow events in a UI-manager-like API
 *
 * Usage:
 * ```typescript
 * const bus = new WorkflowEventBus();
 * const emitter = new WorkflowEventEmitter(bus);
 *
 * // These emit events to the bus
 * emitter.workflowStarted('My Workflow', 5);
 * emitter.addMainAgent('agent-1', 'Planner', 'claude', 0, 5);
 * emitter.updateAgentStatus('agent-1', 'running');
 * ```
 */
export class WorkflowEventEmitter {
  private bus: WorkflowEventBus;
  private agentStepMap = new Map<string, { stepIndex: number; totalSteps: number }>();

  constructor(bus: WorkflowEventBus) {
    this.bus = bus;
  }

  /**
   * Emit a raw event (for custom events)
   */
  emit(event: WorkflowEvent): void {
    this.bus.emit(event);
  }

  // ─────────────────────────────────────────────────────────────────
  // Workflow Lifecycle
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit workflow started event
   */
  workflowStarted(workflowName: string, totalSteps: number): void {
    this.bus.emit({
      type: 'workflow:started',
      workflowName,
      totalSteps,
    });
  }

  /**
   * Emit workflow status change
   */
  setWorkflowStatus(status: WorkflowStatus): void {
    this.bus.emit({
      type: 'workflow:status',
      status,
    });
  }

  /**
   * Emit workflow stopped event
   */
  workflowStopped(reason?: string): void {
    this.bus.emit({
      type: 'workflow:stopped',
      reason,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Main Agents
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit agent added event
   * Mirrors: ui.addMainAgent(name, engine, index, status, customAgentId)
   */
  addMainAgent(
    agentId: string,
    name: string,
    engine: string,
    stepIndex: number,
    totalSteps: number,
    status: AgentStatus = 'pending'
  ): void {
    // Track step info for this agent
    this.agentStepMap.set(agentId, { stepIndex, totalSteps });

    const agent: AgentInfo = {
      id: agentId,
      name,
      engine,
      stepIndex,
      totalSteps,
      status,
    };

    this.bus.emit({
      type: 'agent:added',
      agent,
    });
  }

  /**
   * Emit agent status change
   * Mirrors: ui.updateAgentStatus(agentId, status)
   */
  updateAgentStatus(agentId: string, status: AgentStatus): void {
    this.bus.emit({
      type: 'agent:status',
      agentId,
      status,
    });
  }

  /**
   * Emit agent telemetry update
   * Mirrors: ui.updateAgentTelemetry(agentId, telemetry)
   */
  updateAgentTelemetry(agentId: string, telemetry: Partial<AgentTelemetry>): void {
    this.bus.emit({
      type: 'agent:telemetry',
      agentId,
      telemetry,
    });
  }

  /**
   * Emit agent reset for loop
   * Mirrors: ui.resetAgentForLoop(agentId, cycleNumber)
   */
  resetAgentForLoop(agentId: string, cycleNumber?: number): void {
    this.bus.emit({
      type: 'agent:reset',
      agentId,
      cycleNumber,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Sub-Agents
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit sub-agent added event
   * Mirrors: ui.addSubAgent(parentId, subAgent)
   */
  addSubAgent(parentId: string, subAgent: SubAgentState): void {
    this.bus.emit({
      type: 'subagent:added',
      parentId,
      subAgent,
    });
  }

  /**
   * Emit batch sub-agents added
   * Mirrors: ui.batchAddSubAgents(parentId, subAgents)
   */
  batchAddSubAgents(parentId: string, subAgents: SubAgentState[]): void {
    this.bus.emit({
      type: 'subagent:batch',
      parentId,
      subAgents,
    });
  }

  /**
   * Emit sub-agent status change
   * Mirrors: ui.updateSubAgentStatus(subAgentId, status)
   */
  updateSubAgentStatus(subAgentId: string, status: AgentStatus): void {
    this.bus.emit({
      type: 'subagent:status',
      subAgentId,
      status,
    });
  }

  /**
   * Emit clear sub-agents for parent
   */
  clearSubAgents(parentId: string): void {
    this.bus.emit({
      type: 'subagent:clear',
      parentId,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Triggered Agents
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit triggered agent added event
   * Mirrors: ui.addTriggeredAgent(sourceAgentId, triggeredAgent)
   */
  addTriggeredAgent(sourceAgentId: string, triggeredAgent: TriggeredAgentState): void {
    this.bus.emit({
      type: 'triggered:added',
      sourceAgentId,
      triggeredAgent,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Loop State
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit loop state change
   * Mirrors: ui.setLoopState(loopState)
   */
  setLoopState(loopState: LoopState | null): void {
    this.bus.emit({
      type: 'loop:state',
      loopState,
    });
  }

  /**
   * Emit clear loop round for agent
   * Mirrors: ui.clearLoopRound(agentId)
   */
  clearLoopRound(agentId: string): void {
    this.bus.emit({
      type: 'loop:clear',
      agentId,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Checkpoint State
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit checkpoint state change
   * Mirrors: ui.setCheckpointState(checkpoint)
   */
  setCheckpointState(checkpoint: CheckpointState | null): void {
    this.bus.emit({
      type: 'checkpoint:state',
      checkpoint,
    });
  }

  /**
   * Emit checkpoint cleared
   * Mirrors: ui.clearCheckpointState()
   */
  clearCheckpointState(): void {
    this.bus.emit({
      type: 'checkpoint:clear',
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Messages & UI Elements
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit log message
   * Mirrors: ui.logMessage(agentId, message)
   */
  logMessage(agentId: string, message: string): void {
    this.bus.emit({
      type: 'message:log',
      agentId,
      message,
    });
  }

  /**
   * Emit UI element added
   * Mirrors: ui.addUIElement(text, stepIndex)
   */
  addUIElement(text: string, stepIndex: number): void {
    const element: UIElementInfo = {
      id: `ui-element-${stepIndex}-${Date.now()}`,
      text,
      stepIndex,
    };

    this.bus.emit({
      type: 'ui:element',
      element,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Monitoring Registration
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit monitoring ID registration
   * Mirrors: ui.registerMonitoringId(uiAgentId, monitoringId)
   */
  registerMonitoringId(uiAgentId: string, monitoringId: number): void {
    this.bus.emit({
      type: 'monitoring:register',
      uiAgentId,
      monitoringId,
    });
  }
}

/**
 * Create a new WorkflowEventEmitter
 */
export function createWorkflowEmitter(bus: WorkflowEventBus): WorkflowEventEmitter {
  return new WorkflowEventEmitter(bus);
}
