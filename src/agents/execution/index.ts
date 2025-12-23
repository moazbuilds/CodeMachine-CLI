/**
 * Unified Agent Execution Layer
 *
 * Consolidates telemetry and action parsing into reusable components.
 *
 * Usage:
 * ```typescript
 * import { execute, createTelemetryCallback, parseAction } from '../agents/execution/index.js';
 *
 * // Full unified execution
 * const result = await execute(agentId, prompt, {
 *   workingDir,
 *   telemetry: { uniqueAgentId, emitter },
 *   actions: { enabled: true },
 * });
 *
 * // Just telemetry helper
 * const onTelemetry = createTelemetryCallback({ uniqueAgentId, emitter });
 *
 * // Just action parsing
 * const action = parseAction(output);
 * ```
 */

// Main execution
export { execute, executeWithActions } from './run.js';

// Telemetry helpers
export {
  createTelemetryCallback,
  maybeCreateTelemetryCallback,
} from './telemetry.js';

// Action parsing
export {
  parseAction,
  extractCleanText,
  parseOutput,
  hasAction,
} from './actions.js';

// Types
export type {
  AgentAction,
  ActionParseResult,
  TelemetryTarget,
  TelemetryCallback,
  ActionOptions,
  UnifiedExecuteOptions,
  UnifiedExecuteOutput,
  ParsedTelemetry,
  ChainedPrompt,
  AgentExecutionUI,
} from './types.js';
