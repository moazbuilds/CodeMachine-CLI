/**
 * Session Capture
 *
 * Utilities for capturing agent session information for pause/resume.
 */

import { AgentMonitorService } from '../monitoring/index.js'
import type { CapturedSession } from './types.js'

/**
 * Capture session information for an agent.
 *
 * Extracts the base agent ID (removing step suffix), queries the monitor
 * for matching agents, and returns the most recent session info.
 *
 * @param stepAgentId - The step agent ID (e.g., "bmad-architect-step-2")
 * @returns Captured session info or null if not found
 */
export function captureSession(stepAgentId: string): CapturedSession | null {
  // Agent is registered with base ID (e.g., "bmad-architect" not "bmad-architect-step-2")
  const baseId = stepAgentId.replace(/-step-\d+$/, '')
  const monitor = AgentMonitorService.getInstance()
  const agents = monitor.queryAgents({ name: baseId })

  if (!agents.length) return null

  // Get the most recent agent entry
  const latest = agents.reduce((a, b) => (a.id > b.id ? a : b))

  return {
    agentId: baseId,
    monitoringId: latest.id,
    sessionId: latest.sessionId ?? null,
  }
}
