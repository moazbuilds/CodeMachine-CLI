/**
 * Chat Turn Types
 *
 * Types for the unified conversation turn handling.
 */

import type { EngineType } from '../../infra/engines/index.js'

export interface TurnConfig {
  agentId: string
  sessionId: string
  monitoringId: number
  prompt: string
  cwd: string
  engine?: EngineType
  model?: string
}

export interface TurnResult {
  success: boolean
  error?: Error
}
