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

/**
 * Options for controller agent initialization
 */
export interface InitControllerOptions {
  /** Callback when monitoring ID becomes available (for log streaming) */
  onMonitoringId?: (monitoringId: number) => void
  /** Engine override (from workflow definition.options) - passed to executeAgent */
  engineOverride?: string
  /** Model override (from workflow definition.options) - passed to executeAgent */
  modelOverride?: string
}

/**
 * Result of controller agent initialization
 * Includes resolved engine/model from executeAgent (via MonitorService)
 */
export interface InitControllerResult {
  agentId: string
  sessionId: string
  monitoringId: number
  /** Resolved engine used by agent */
  engine: string
  /** Resolved model used by agent */
  model?: string
}
