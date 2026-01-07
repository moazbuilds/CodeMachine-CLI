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
  InputState,
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
  orderIndex: number; // Overall step position for timeline ordering
}

/**
 * Separator information (visual dividers in timeline)
 */
export interface SeparatorInfo {
  id: string;
  text: string;
  stepIndex: number;
}

/**
 * Progress tracking state
 */
export interface ProgressState {
  currentStep: number;
  totalSteps: number;
  stepName?: string;
}

// ─────────────────────────────────────────────────────────────────
// Onboarding Types
// ─────────────────────────────────────────────────────────────────

/**
 * Onboarding step identifiers
 */
export type OnboardStep = 'project_name' | 'tracks' | 'condition_group' | 'condition_child' | 'controller' | 'launching';

/**
 * Onboarding configuration passed to service
 */
export interface OnboardConfig {
  hasTracks: boolean;
  hasConditions: boolean;
  hasController: boolean;
  initialProjectName?: string | null;
}

/**
 * Onboarding result returned on completion
 */
export interface OnboardResult {
  projectName?: string;
  trackId?: string;
  conditions?: string[];
  controllerAgentId?: string;
}

/**
 * All workflow events that UI adapters can subscribe to
 */
export type WorkflowEvent =
  // Agent lifecycle events
  | { type: 'agent:added'; agent: AgentInfo }
  | { type: 'agent:status'; agentId: string; status: AgentStatus }
  | { type: 'agent:engine'; agentId: string; engine: string }
  | { type: 'agent:model'; agentId: string; model: string }
  | { type: 'agent:telemetry'; agentId: string; telemetry: Partial<AgentTelemetry> }
  | { type: 'agent:reset'; agentId: string; cycleNumber?: number }

  // Controller agent events
  | { type: 'controller:info'; id: string; name: string; engine: string; model?: string }
  | { type: 'controller:engine'; engine: string }
  | { type: 'controller:model'; model: string }
  | { type: 'controller:telemetry'; telemetry: Partial<AgentTelemetry> }

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

  // Input state events (unified pause/chained)
  | { type: 'input:state'; inputState: InputState | null }

  // Chained prompts events (deprecated - use input:state)
  | { type: 'chained:state'; chainedState: ChainedState | null }

  // Message/logging events
  | { type: 'message:log'; agentId: string; message: string }

  // Separator events (visual dividers)
  | { type: 'separator:add'; separator: SeparatorInfo }

  // Monitoring ID registration (for log file access)
  | { type: 'monitoring:register'; uiAgentId: string; monitoringId: number }

  // Progress tracking (step indicator)
  | { type: 'progress:state'; progress: ProgressState | null }

  // Onboarding events
  | { type: 'onboard:started'; config: OnboardConfig }
  | { type: 'onboard:step'; step: OnboardStep; question: string }
  | { type: 'onboard:project_name'; name: string }
  | { type: 'onboard:track'; trackId: string }
  | { type: 'onboard:condition'; conditionId: string; groupIndex: number; isChild: boolean }
  | { type: 'onboard:conditions_confirmed'; conditions: string[]; groupIndex: number }
  | { type: 'onboard:completed'; result: OnboardResult }
  | { type: 'onboard:cancelled' }

  // Controller launching events (during onboarding)
  | { type: 'onboard:launching_started'; controllerId: string; controllerName: string }
  | { type: 'onboard:launching_log'; message: string }
  | { type: 'onboard:launching_monitor'; monitoringId: number }
  | { type: 'onboard:launching_completed'; controllerId: string }
  | { type: 'onboard:launching_failed'; controllerId: string; error: string };

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
