/**
 * Unified Agent Execution
 *
 * Main entry point for agent execution that provides:
 * - Automatic telemetry forwarding (when telemetry options provided)
 * - Optional action parsing (when actions.enabled is true)
 * - Full backward compatibility with executeAgent
 */

import { executeAgent } from '../runner/runner.js';
import { maybeCreateTelemetryCallback } from './telemetry.js';
import { parseOutput } from './actions.js';
import type { UnifiedExecuteOptions, UnifiedExecuteOutput } from './types.js';

/**
 * Execute an agent with unified telemetry and action support
 *
 * This is the primary entry point for agent execution that provides:
 * - Automatic telemetry forwarding (when telemetry options provided)
 * - Optional action parsing (when actions.enabled is true)
 * - Full backward compatibility with executeAgent
 *
 * Usage:
 * ```typescript
 * // Basic usage (same as executeAgent)
 * const result = await execute(agentId, prompt, { workingDir });
 *
 * // With telemetry forwarding
 * const result = await execute(agentId, prompt, {
 *   workingDir,
 *   telemetry: { uniqueAgentId, emitter },
 * });
 *
 * // With action parsing
 * const result = await execute(agentId, prompt, {
 *   workingDir,
 *   actions: { enabled: true },
 * });
 * if (result.action === 'NEXT') { ... }
 * ```
 */
export async function execute(
  agentId: string,
  prompt: string,
  options: UnifiedExecuteOptions,
): Promise<UnifiedExecuteOutput> {
  // Extract our custom options
  const { telemetry, actions, ...baseOptions } = options;

  // Set up telemetry callback if telemetry target provided
  const onTelemetry = maybeCreateTelemetryCallback(telemetry);

  // Call the base executeAgent
  const result = await executeAgent(agentId, prompt, {
    ...baseOptions,
    onTelemetry,
  });

  // Build extended output
  const output: UnifiedExecuteOutput = {
    ...result,
  };

  // Parse actions if enabled
  if (actions?.enabled) {
    const parsed = parseOutput(result.output);
    output.action = parsed.action;
    output.cleanedOutput = parsed.cleanedOutput;
  }

  return output;
}

/**
 * Convenience function for execution with action parsing
 *
 * Equivalent to: execute(agentId, prompt, { ...options, actions: { enabled: true } })
 */
export async function executeWithActions(
  agentId: string,
  prompt: string,
  options: Omit<UnifiedExecuteOptions, 'actions'>,
): Promise<UnifiedExecuteOutput> {
  return execute(agentId, prompt, {
    ...options,
    actions: { enabled: true },
  });
}
