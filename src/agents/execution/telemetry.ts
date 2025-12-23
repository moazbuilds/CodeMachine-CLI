/**
 * Telemetry Helpers for Agent Execution
 *
 * Reusable telemetry callback builders that forward
 * telemetry data to workflow event emitters.
 */

import type { ParsedTelemetry, TelemetryTarget, TelemetryCallback } from './types.js';

/**
 * Creates a telemetry callback that forwards to the workflow emitter
 *
 * Usage:
 * ```typescript
 * const onTelemetry = createTelemetryCallback({
 *   uniqueAgentId: 'agent-1',
 *   emitter: workflowEmitter,
 * });
 *
 * await executeAgent(agentId, prompt, {
 *   ...options,
 *   onTelemetry,
 * });
 * ```
 */
export function createTelemetryCallback(target: TelemetryTarget): TelemetryCallback {
  const { uniqueAgentId, emitter } = target;

  return (telemetry: ParsedTelemetry) => {
    emitter.updateAgentTelemetry(uniqueAgentId, telemetry);
  };
}

/**
 * Optionally creates a telemetry callback based on provided options
 *
 * Returns undefined if telemetry target is incomplete (missing uniqueAgentId or emitter).
 * This is the primary helper for conditional telemetry setup.
 *
 * Usage:
 * ```typescript
 * const onTelemetry = maybeCreateTelemetryCallback({
 *   uniqueAgentId: options.uniqueAgentId,
 *   emitter: options.emitter,
 * });
 *
 * // onTelemetry is undefined if uniqueAgentId or emitter is missing
 * ```
 */
export function maybeCreateTelemetryCallback(
  target: Partial<TelemetryTarget> | undefined
): TelemetryCallback | undefined {
  if (!target?.uniqueAgentId || !target?.emitter) {
    return undefined;
  }

  return createTelemetryCallback({
    uniqueAgentId: target.uniqueAgentId,
    emitter: target.emitter,
  });
}
