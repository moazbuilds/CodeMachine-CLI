/**
 * Session Resume
 *
 * Utilities for resuming agent sessions.
 */

import { executeAgent } from '../runner/runner.js'
import type { EngineType } from '../../infra/engines/index.js'

export interface ResumeConfig {
  /** Agent ID to resume */
  agentId: string
  /** Session ID for resume context */
  sessionId?: string
  /** Monitoring ID for log continuation */
  monitoringId?: number
  /** Prompt to send to the agent */
  prompt: string
  /** Working directory */
  cwd: string
  /** Engine override */
  engine?: EngineType
  /** Model override */
  model?: string
}

/**
 * Resume an agent session with a new prompt.
 *
 * @param cfg - Resume configuration
 */
export async function resumeAgent(cfg: ResumeConfig): Promise<void> {
  await executeAgent(cfg.agentId, cfg.prompt, {
    workingDir: cfg.cwd,
    resumeSessionId: cfg.sessionId,
    resumePrompt: cfg.prompt,
    resumeMonitoringId: cfg.monitoringId,
    engine: cfg.engine,
    model: cfg.model,
  })
}
