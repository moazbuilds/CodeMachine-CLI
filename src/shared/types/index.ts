/**
 * Shared type definitions used across all layers
 */

// ============================================================================
// Core Domain Types
// ============================================================================

export type WorkflowId = string & { readonly __brand: 'WorkflowId' }
export type StepId = string & { readonly __brand: 'StepId' }
export type AgentId = string & { readonly __brand: 'AgentId' }
export type SessionId = string & { readonly __brand: 'SessionId' }
export type MonitoringId = number & { readonly __brand: 'MonitoringId' }

// Type-safe ID creators
export const createWorkflowId = (id: string): WorkflowId => id as WorkflowId
export const createStepId = (id: string): StepId => id as StepId
export const createAgentId = (id: string): AgentId => id as AgentId
export const createSessionId = (id: string): SessionId => id as SessionId
export const createMonitoringId = (id: number): MonitoringId => id as MonitoringId

// ============================================================================
// Workflow Status Types
// ============================================================================

export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'completed'
  | 'stopped'
  | 'error'

export type AgentStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'error'
  | 'skipped'

export type InputMode = 'user' | 'autopilot'

// ============================================================================
// Telemetry Types
// ============================================================================

export interface Telemetry {
  readonly tokensIn: number
  readonly tokensOut: number
  readonly cost: number
  readonly cached?: number
}

export interface Duration {
  readonly startedAt: number
  readonly endedAt?: number
  readonly pausedDuration: number
  readonly total: number
}

// ============================================================================
// Step & Prompt Types
// ============================================================================

export interface StepConfig {
  readonly type: 'module' | 'ui'
  readonly agentId: AgentId
  readonly agentName: string
  readonly promptPath: string | string[]
  readonly model?: string
  readonly engine?: string
  readonly tracks?: string[]
  readonly conditions?: string[]
  readonly autopilot?: StepAutopilotConfig
}

export interface StepAutopilotConfig {
  readonly enabled?: boolean
  readonly autoAdvance?: boolean
  readonly maxRetries?: number
}

export interface ChainedPrompt {
  readonly name: string
  readonly label: string
  readonly content: string
  readonly conditions?: string[]
}

// ============================================================================
// Wait Reason Types (Discriminated Union)
// ============================================================================

export type WaitReason =
  | { readonly type: 'user-input'; readonly prompt?: string }
  | { readonly type: 'chained-prompt'; readonly chainIndex: number; readonly prompts: ChainedPrompt[] }
  | { readonly type: 'checkpoint'; readonly message: string }
  | { readonly type: 'error-recovery'; readonly error: string }

// ============================================================================
// Resume Strategy Types (Discriminated Union)
// ============================================================================

export type ResumeStrategy =
  | { readonly type: 'fresh' }
  | { readonly type: 'chain-resume'; readonly chainIndex: number; readonly sessionId: SessionId }
  | { readonly type: 'pause-resume'; readonly sessionId: SessionId; readonly pausedAt: number }
  | { readonly type: 'crash-recovery'; readonly lastCheckpoint: number }
  | { readonly type: 'fallback-first'; readonly fallbackAgentId: AgentId; readonly then: ResumeStrategy }

// ============================================================================
// Engine Types
// ============================================================================

export type EngineName = 'claude' | 'cursor' | 'codex' | 'ccr' | 'auggie' | 'opencode' | 'gemini'

export interface EngineCapabilities {
  readonly streaming: boolean
  readonly multiTurn: boolean
  readonly toolUse: boolean
  readonly maxTokens: number
}

// ============================================================================
// Result Type (Functional Error Handling)
// ============================================================================

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } => result.ok
export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } => !result.ok

// ============================================================================
// Utility Types
// ============================================================================

export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : T extends object
    ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
    : T

export type Unsubscribe = () => void

export interface Disposable {
  dispose(): void | Promise<void>
}

// ============================================================================
// Time Utilities
// ============================================================================

export const now = (): number => Date.now()

export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}
