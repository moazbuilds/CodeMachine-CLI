/**
 * Session Types
 *
 * Types for agent session capture and resume operations.
 */

export interface CapturedSession {
  /** Base agent ID (without step suffix) */
  agentId: string
  /** Monitoring ID for the agent */
  monitoringId: number
  /** Session ID for resume (null if not available) */
  sessionId: string | null
}
