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
 *
 * For controller telemetry:
 * ```typescript
 * const onTelemetry = createTelemetryCallback({
 *   uniqueAgentId: '', // not used for controller
 *   emitter: workflowEmitter,
 *   isController: true,
 * });
 * ```
 */
export function createTelemetryCallback(target: TelemetryTarget): TelemetryCallback {
  const { uniqueAgentId, emitter, isController } = target;

  return (telemetry: ParsedTelemetry) => {
    if (isController) {
      emitter.updateControllerTelemetry(telemetry);
    } else {
      emitter.updateAgentTelemetry(uniqueAgentId, telemetry);
    }
  };
}

/**
 * Optionally creates a telemetry callback based on provided options
 *
 * Returns undefined if telemetry target is incomplete:
 * - For regular agents: missing uniqueAgentId or emitter
 * - For controller: missing emitter (uniqueAgentId not required)
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
  if (!target?.emitter) {
    return undefined;
  }

  // For controller, uniqueAgentId is not required
  if (target.isController) {
    return createTelemetryCallback({
      uniqueAgentId: '', // not used for controller
      emitter: target.emitter,
      isController: true,
    });
  }

  // For regular agents, uniqueAgentId is required
  if (!target.uniqueAgentId) {
    return undefined;
  }

  return createTelemetryCallback({
    uniqueAgentId: target.uniqueAgentId,
    emitter: target.emitter,
  });
}
