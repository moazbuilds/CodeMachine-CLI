/**
 * Database Schema Index
 *
 * Exports all Drizzle ORM schema definitions.
 */

// Agents & Telemetry (per-agent)
export {
  agents,
  agentsRelations,
  telemetry,
  telemetryRelations,
  AGENT_STATUS,
  type AgentStatus,
  type Agent,
  type NewAgent,
  type Telemetry,
  type NewTelemetry,
} from './agents.js'

// Telemetry Snapshots (historical analytics)
export {
  telemetrySnapshots,
  telemetrySnapshotsRelations,
  telemetryDaily,
  type TelemetrySnapshot,
  type NewTelemetrySnapshot,
  type TelemetryDaily,
  type NewTelemetryDaily,
  type CostByPeriod,
  type EngineUsage,
  type WorkflowMetrics,
} from './telemetry.js'

// Events (event sourcing)
export {
  events,
  type Event,
  type NewEvent,
  type EventQueryOptions,
  type EventReplayHandler,
  type EventStoreStats,
} from './events.js'

// Logs (indexed with FTS5)
export {
  logs,
  logsRelations,
  LOG_LEVELS,
  type LogLevel,
  type Log,
  type NewLog,
  type LogSearchParams,
  type LogSearchResult,
  type LogLevelCounts,
} from './logs.js'

// Workflow State (crash recovery)
export {
  workflowStates,
  workflowStatesRelations,
  workflowCheckpoints,
  workflowCheckpointsRelations,
  WORKFLOW_STATES,
  type WorkflowStateValue,
  type WorkflowState,
  type NewWorkflowState,
  type WorkflowCheckpoint,
  type NewWorkflowCheckpoint,
  type PersistedWorkflowContext,
  type WorkflowRecoveryResult,
} from './workflow-state.js'
