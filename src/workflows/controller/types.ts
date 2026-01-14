/**
 * Controller Types
 *
 * Types for controller configuration and autonomous mode.
 */

// Re-export the base ControllerConfig from shared template types
export type { ControllerConfig } from '../../shared/workflows/template.js'

/**
 * Extended controller config for view operations (includes engine/model)
 */
export interface ViewControllerConfig {
  agentId: string
  sessionId: string
  monitoringId: number
  engine?: string
  model?: string
}

/**
 * Autonomous mode values
 * - 'true': Autonomous mode (controller makes decisions)
 * - 'false': Manual mode (user provides input)
 * - 'never': Never auto (always manual, used in controller conversation)
 * - 'always': Always auto (no user input allowed)
 */
export type AutonomousMode = 'true' | 'false' | 'never' | 'always'
