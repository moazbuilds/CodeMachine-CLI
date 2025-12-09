/**
 * Workflow Event Types
 *
 * Typed events for decoupling workflow execution from UI.
 * The workflow emits these events, and any UI adapter can subscribe.
 */

import type {
  AgentStatus,
  AgentTelemetry,
  LoopState,
  CheckpointState,
  ChainedState,
  WorkflowStatus,
  SubAgentState,
  TriggeredAgentState,
} from '../../cli/tui/routes/workflow/state/types.js';

/**
 * Agent information for adding to UI
 */
export interface AgentInfo {
  id: string;
  name: string;
  engine: string;
  model?: string;
  stepIndex: number;
  totalSteps: number;
  status: AgentStatus;
}

/**
 * UI element information (text labels in timeline)
 */
export interface UIElementInfo {
  id: string;
  text: string;
  stepIndex: number;
}

/**
 * All workflow events that UI adapters can subscribe to
 */
export type WorkflowEvent =
  // Agent lifecycle events
  | { type: 'agent:added'; agent: AgentInfo }
  | { type: 'agent:status'; agentId: string; status: AgentStatus }
  | { type: 'agent:model'; agentId: string; model: string }
  | { type: 'agent:telemetry'; agentId: string; telemetry: Partial<AgentTelemetry> }
  | { type: 'agent:reset'; agentId: string; cycleNumber?: number }

  // Sub-agent events
  | { type: 'subagent:added'; parentId: string; subAgent: SubAgentState }
  | { type: 'subagent:batch'; parentId: string; subAgents: SubAgentState[] }
  | { type: 'subagent:status'; subAgentId: string; status: AgentStatus }
  | { type: 'subagent:clear'; parentId: string }

  // Triggered agent events
  | { type: 'triggered:added'; sourceAgentId: string; triggeredAgent: TriggeredAgentState }

  // Workflow state events
  | { type: 'workflow:status'; status: WorkflowStatus }
  | { type: 'workflow:started'; workflowName: string; totalSteps: number }
  | { type: 'workflow:stopped'; reason?: string }

  // Loop events
  | { type: 'loop:state'; loopState: LoopState | null }
  | { type: 'loop:clear'; agentId: string }

  // Checkpoint events
  | { type: 'checkpoint:state'; checkpoint: CheckpointState | null }
  | { type: 'checkpoint:clear' }

  // Chained prompts events
  | { type: 'chained:state'; chainedState: ChainedState | null }

  // Message/logging events
  | { type: 'message:log'; agentId: string; message: string }

  // UI element events
  | { type: 'ui:element'; element: UIElementInfo }

  // Monitoring ID registration (for log file access)
  | { type: 'monitoring:register'; uiAgentId: string; monitoringId: number };

/**
 * Extract event type from WorkflowEvent union
 */
export type WorkflowEventType = WorkflowEvent['type'];

/**
 * Get payload type for a specific event type
 */
export type WorkflowEventPayload<T extends WorkflowEventType> = Extract<
  WorkflowEvent,
  { type: T }
>;

/**
 * Listener function type for workflow events
 */
export type WorkflowEventListener = (event: WorkflowEvent) => void;

/**
 * Typed listener for specific event type
 */
export type TypedEventListener<T extends WorkflowEventType> = (
  event: WorkflowEventPayload<T>
) => void;
