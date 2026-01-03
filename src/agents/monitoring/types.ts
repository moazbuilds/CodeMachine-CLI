import type { ParsedTelemetry } from '../../shared/telemetry/index.js';
import type { EngineType } from '../../infra/engines/core/types.js';

/**
 * Agent execution status
 */
export type AgentStatus = 'running' | 'completed' | 'failed' | 'paused' | 'skipped';

/**
 * Complete agent record stored in registry
 */
export interface AgentRecord {
  /** Unique auto-incremented ID */
  id: number;

  /** Agent name/type (e.g., 'frontend', 'backend', 'plan-creator') */
  name: string;

  /** Engine type used for execution (e.g., 'claude', 'codex', 'cursor') */
  engine?: EngineType;

  /** Current execution status */
  status: AgentStatus;

  /** Parent agent ID (for sub-agents spawned via workflow triggers or orchestration) */
  parentId?: number;

  /** Process ID for real-time validation */
  pid?: number;

  /** ISO timestamp when agent started */
  startTime: string;

  /** ISO timestamp when agent completed/failed */
  endTime?: string;

  /** Execution duration in milliseconds */
  duration?: number;

  /** Original prompt/instruction given to agent */
  prompt: string;

  /** Absolute path to agent's log file */
  logPath: string;

  /** Telemetry data (tokens, cost, etc.) */
  telemetry?: ParsedTelemetry;

  /** Child agent IDs spawned by this agent */
  children: number[];

  /** Error message if status is 'failed' */
  error?: string;

  /** Engine provider (e.g., 'anthropic', 'openai', 'cursor') */
  engineProvider?: string;

  /** Model name (e.g., 'claude-sonnet-4', 'gpt-4-turbo') */
  modelName?: string;

  /** Session/thread ID for resume capability (engine-specific) */
  sessionId?: string;
}

/**
 * Input for registering a new agent
 */
export interface RegisterAgentInput {
  name: string;
  prompt: string;
  parentId?: number;
  pid?: number;
  engine?: EngineType;
  engineProvider?: string;
  modelName?: string;
}

/**
 * Persisted registry structure
 */
export interface AgentRegistryData {
  /** Last assigned agent ID */
  lastId: number;

  /** Map of agent ID to agent record */
  agents: Record<number, AgentRecord>;
}

/**
 * Query filters for retrieving agents
 */
export interface AgentQueryFilters {
  status?: AgentStatus | AgentStatus[];
  parentId?: number;
  name?: string;
}
