/**
 * Named Meters
 *
 * Provides named meter instances for different subsystems.
 * Each meter is scoped to a specific domain for better organization.
 */

import { metrics, Meter } from '@opentelemetry/api';

/**
 * Meter names for different subsystems
 */
export const METER_NAMES = {
  PROCESS: 'codemachine.process',
  ENGINE: 'codemachine.engine',
  AGENT: 'codemachine.agent',
  MCP: 'codemachine.mcp',
  SESSION: 'codemachine.session',
  TUI: 'codemachine.tui',
} as const;

/**
 * Get the process meter (for memory, CPU, event loop metrics)
 */
export function getProcessMeter(): Meter {
  return metrics.getMeter(METER_NAMES.PROCESS);
}

/**
 * Get the engine meter (for engine/LLM metrics)
 * To be used in Phase 4
 */
export function getEngineMeter(): Meter {
  return metrics.getMeter(METER_NAMES.ENGINE);
}

/**
 * Get the agent meter (for agent lifecycle metrics)
 * To be used in Phase 2
 */
export function getAgentMeter(): Meter {
  return metrics.getMeter(METER_NAMES.AGENT);
}

/**
 * Get the MCP meter (for MCP operations metrics)
 * To be used in Phase 3
 */
export function getMcpMeter(): Meter {
  return metrics.getMeter(METER_NAMES.MCP);
}

/**
 * Get the session meter (for session-level metrics)
 */
export function getSessionMeter(): Meter {
  return metrics.getMeter(METER_NAMES.SESSION);
}

/**
 * Get the TUI meter (for TUI metrics)
 * To be used in Phase 5
 */
export function getTuiMeter(): Meter {
  return metrics.getMeter(METER_NAMES.TUI);
}
