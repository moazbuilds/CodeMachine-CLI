import type { EngineType } from '../../infra/engines/index.js';

/**
 * Agent execution status types
 */
export type AgentStatus =
  | 'pending'      // ○ - Not yet started
  | 'running'      // ⠋ - Currently executing
  | 'completed'    // ● - Successfully finished
  | 'failed'       // ✗ - Failed with error
  | 'skipped'      // ● - Skipped in loop
  | 'retrying';    // ⟳ - Retrying after failure

/**
 * Agent telemetry data tracked across all engines
 */
export interface AgentTelemetry {
  tokensIn: number;
  tokensOut: number;
  cached?: number;      // Optional: not all engines provide
  cost?: number;        // Optional: calculated if pricing available
  duration?: number;    // Optional: in seconds
}

/**
 * Complete state for a main workflow agent
 */
export interface AgentState {
  id: string;
  name: string;
  engine: EngineType;
  status: AgentStatus;
  telemetry: AgentTelemetry;
  startTime: number;
  endTime?: number;
  error?: string;
  toolCount: number;
  thinkingCount: number;
  loopRound?: number;  // Current loop iteration number (e.g., 1, 2, 3...)
  loopReason?: string; // Reason for the current loop iteration
  stepIndex?: number;  // Current step index (0-based)
  totalSteps?: number; // Total number of steps in workflow
  monitoringId?: number; // Maps to AgentMonitorService registry ID for log file access
}

/**
 * Sub-agent state extending main agent with parent reference
 */
export interface SubAgentState extends AgentState {
  parentId: string;
}

/**
 * Triggered agent state with source attribution
 */
export interface TriggeredAgentState extends AgentState {
  triggeredBy: string;  // Source agent ID
  triggerCondition?: string;  // Optional: condition that triggered the agent
}

/**
 * Loop execution state
 */
export interface LoopState {
  active: boolean;
  sourceAgent: string;
  backSteps: number;
  iteration: number;
  maxIterations: number;
  skipList: string[];
  reason?: string;
}

/**
 * Workflow execution status
 */
export type WorkflowStatus = 'running' | 'stopping' | 'completed' | 'stopped' | 'checkpoint';

/**
 * Checkpoint state for manual review
 */
export interface CheckpointState {
  active: boolean;
  reason?: string;
}

/**
 * Record of a single agent execution (including loop cycles)
 * Used to track complete execution history for telemetry
 */
export interface ExecutionRecord {
  id: string;                    // Unique ID for this execution
  agentName: string;             // Agent name
  agentId: string;               // Original agent ID
  cycleNumber?: number;          // Cycle number if from loop
  engine: EngineType;
  status: AgentStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  telemetry: AgentTelemetry;
  toolCount: number;
  thinkingCount: number;
  error?: string;
}

/**
 * UI element for displaying static messages in the timeline
 */
export interface UIElement {
  id: string;
  text: string;
  stepIndex: number;  // Position in workflow steps
}

/**
 * Complete workflow UI state
 */
export interface WorkflowState {
  workflowName: string;
  version: string;
  packageName: string;
  startTime: number;
  endTime?: number;  // Set when workflow stops (Ctrl+C or completion)

  agents: AgentState[];
  subAgents: Map<string, SubAgentState[]>;
  triggeredAgents: TriggeredAgentState[];
  uiElements: UIElement[];  // Static UI elements for checkpoints/messages
  executionHistory: ExecutionRecord[];  // Complete execution history for telemetry

  loopState: LoopState | null;
  checkpointState: CheckpointState | null;
  expandedNodes: Set<string>;

  showTelemetryView: boolean;
  selectedAgentId: string | null;
  selectedSubAgentId: string | null;
  selectedItemType: 'main' | 'summary' | 'sub' | null;  // Track what type of item is selected

  // Viewport information for the agent timeline
  visibleItemCount: number;  // Number of terminal rows available for the timeline viewport

  // Scrolling state for agent timeline
  scrollOffset: number;  // Index of the first visible item in the flat navigable list

  // Workflow progress tracking
  totalSteps: number;
  workflowStatus: WorkflowStatus;  // Current execution status

  // Version counter for agent ID mapping changes
  // Incremented when registerMonitoringId is called to trigger re-renders
  agentIdMapVersion: number;
}
