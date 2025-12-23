/**
 * Unified Agent Execution Types
 *
 * Types for the unified execution layer that provides
 * telemetry and action parsing as reusable features.
 */

import type { ParsedTelemetry } from '../../infra/engines/core/types.js';
import type { WorkflowEventEmitter } from '../../workflows/events/emitter.js';
import type {
  ExecuteAgentOptions,
  AgentExecutionOutput,
  AgentExecutionUI,
} from '../runner/runner.js';
import type { ChainedPrompt } from '../runner/chained.js';

// Re-export for convenience
export type { ParsedTelemetry, ChainedPrompt, AgentExecutionUI };

/**
 * Universal action type - any agent can use these
 *
 * Actions are special commands that agents can emit to control workflow:
 * - NEXT: Continue to next step/prompt
 * - SKIP: Skip remaining prompts in queue
 * - STOP: Stop the workflow
 */
export type AgentAction = 'NEXT' | 'SKIP' | 'STOP';

/**
 * Result of parsing agent output for actions
 */
export interface ActionParseResult {
  /** Detected action, if any */
  action: AgentAction | null;
  /** Cleaned output text with action markers removed */
  cleanedOutput: string;
}

/**
 * Target for telemetry forwarding
 */
export interface TelemetryTarget {
  /** Unique agent ID for UI updates */
  uniqueAgentId: string;
  /** Event emitter for telemetry updates */
  emitter: WorkflowEventEmitter;
}

/**
 * Telemetry callback type
 */
export type TelemetryCallback = (telemetry: ParsedTelemetry) => void;

/**
 * Options for action parsing (opt-in feature)
 */
export interface ActionOptions {
  /** Enable action parsing in output */
  enabled: boolean;
}

/**
 * Extended options for unified execution
 *
 * Builds on ExecuteAgentOptions with additional features:
 * - telemetry: Auto-forward telemetry to workflow emitter
 * - actions: Parse output for NEXT/SKIP/STOP commands
 */
export interface UnifiedExecuteOptions extends Omit<ExecuteAgentOptions, 'onTelemetry'> {
  /**
   * Telemetry forwarding options (optional)
   * If provided, sets up automatic telemetry forwarding to emitter
   */
  telemetry?: TelemetryTarget;

  /**
   * Action parsing options (optional, opt-in)
   * If enabled, output is parsed for NEXT/SKIP/STOP commands
   */
  actions?: ActionOptions;
}

/**
 * Extended output from unified execution
 */
export interface UnifiedExecuteOutput extends AgentExecutionOutput {
  /** Parsed action from output (if actions.enabled) */
  action?: AgentAction | null;
  /** Cleaned output text (action markers removed if actions.enabled) */
  cleanedOutput?: string;
}
