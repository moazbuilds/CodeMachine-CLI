/**
 * Domain event type definitions
 * All events are immutable and carry timestamp + correlation data
 */

import type { AgentId, AgentStatus, SessionId, StepId, Telemetry, WorkflowId, WorkflowStatus } from '../../shared/types'

// ============================================================================
// Base Event Interface
// ============================================================================

export interface DomainEvent {
  readonly type: string
  readonly timestamp: number
  readonly correlationId?: string
  readonly causationId?: string
}

// ============================================================================
// Workflow Events
// ============================================================================

export interface WorkflowStartedEvent extends DomainEvent {
  readonly type: 'workflow:started'
  readonly workflowId: WorkflowId
  readonly totalSteps: number
}

export interface WorkflowStatusChangedEvent extends DomainEvent {
  readonly type: 'workflow:status-changed'
  readonly workflowId: WorkflowId
  readonly previousStatus: WorkflowStatus
  readonly currentStatus: WorkflowStatus
  readonly stepIndex?: number
}

export interface WorkflowStoppedEvent extends DomainEvent {
  readonly type: 'workflow:stopped'
  readonly workflowId: WorkflowId
  readonly reason: 'user' | 'error' | 'completed'
  readonly finalStepIndex: number
}

export interface WorkflowPausedEvent extends DomainEvent {
  readonly type: 'workflow:paused'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly reason: string
}

export interface WorkflowResumedEvent extends DomainEvent {
  readonly type: 'workflow:resumed'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly resumeStrategy: string
}

export interface WorkflowErrorEvent extends DomainEvent {
  readonly type: 'workflow:error'
  readonly workflowId: WorkflowId
  readonly error: {
    code: string
    message: string
    stepIndex?: number
  }
}

// ============================================================================
// Step Events
// ============================================================================

export interface StepStartedEvent extends DomainEvent {
  readonly type: 'step:started'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly stepId: StepId
  readonly agentId: AgentId
  readonly agentName: string
}

export interface StepCompletedEvent extends DomainEvent {
  readonly type: 'step:completed'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly stepId: StepId
  readonly output?: string
  readonly duration: number
}

export interface StepSkippedEvent extends DomainEvent {
  readonly type: 'step:skipped'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly stepId: StepId
  readonly reason: string
}

export interface StepErrorEvent extends DomainEvent {
  readonly type: 'step:error'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly stepId: StepId
  readonly error: {
    code: string
    message: string
  }
}

// ============================================================================
// Agent Events
// ============================================================================

export interface AgentAddedEvent extends DomainEvent {
  readonly type: 'agent:added'
  readonly agentId: AgentId
  readonly name: string
  readonly engine: string
  readonly stepIndex: number
  readonly totalSteps: number
}

export interface AgentStatusChangedEvent extends DomainEvent {
  readonly type: 'agent:status-changed'
  readonly agentId: AgentId
  readonly previousStatus: AgentStatus
  readonly currentStatus: AgentStatus
}

export interface AgentTelemetryEvent extends DomainEvent {
  readonly type: 'agent:telemetry'
  readonly agentId: AgentId
  readonly telemetry: Telemetry
  readonly cumulative: boolean
}

export interface AgentOutputEvent extends DomainEvent {
  readonly type: 'agent:output'
  readonly agentId: AgentId
  readonly output: string
  readonly isPartial: boolean
}

export interface AgentSessionEvent extends DomainEvent {
  readonly type: 'agent:session'
  readonly agentId: AgentId
  readonly sessionId: SessionId
  readonly monitoringId: number
}

// ============================================================================
// Sub-Agent Events
// ============================================================================

export interface SubAgentAddedEvent extends DomainEvent {
  readonly type: 'subagent:added'
  readonly parentAgentId: AgentId
  readonly subAgentId: AgentId
  readonly name: string
  readonly model?: string
}

export interface SubAgentBatchEvent extends DomainEvent {
  readonly type: 'subagent:batch'
  readonly parentAgentId: AgentId
  readonly subAgents: Array<{
    id: AgentId
    name: string
    model?: string
    status: AgentStatus
  }>
}

export interface SubAgentStatusChangedEvent extends DomainEvent {
  readonly type: 'subagent:status-changed'
  readonly parentAgentId: AgentId
  readonly subAgentId: AgentId
  readonly status: AgentStatus
}

// ============================================================================
// Input Events
// ============================================================================

export interface InputRequestedEvent extends DomainEvent {
  readonly type: 'input:requested'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly prompt?: string
  readonly chainedPrompts?: Array<{
    name: string
    label: string
  }>
}

export interface InputReceivedEvent extends DomainEvent {
  readonly type: 'input:received'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly input: string
  readonly source: 'user' | 'autopilot' | 'queue'
}

export interface InputModeChangedEvent extends DomainEvent {
  readonly type: 'input:mode-changed'
  readonly workflowId: WorkflowId
  readonly previousMode: 'user' | 'autopilot'
  readonly currentMode: 'user' | 'autopilot'
}

// ============================================================================
// Checkpoint Events
// ============================================================================

export interface CheckpointCreatedEvent extends DomainEvent {
  readonly type: 'checkpoint:created'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly message: string
}

export interface CheckpointResolvedEvent extends DomainEvent {
  readonly type: 'checkpoint:resolved'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly action: 'continue' | 'skip' | 'stop'
}

// ============================================================================
// Loop Events
// ============================================================================

export interface LoopStartedEvent extends DomainEvent {
  readonly type: 'loop:started'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly iteration: number
}

export interface LoopCompletedEvent extends DomainEvent {
  readonly type: 'loop:completed'
  readonly workflowId: WorkflowId
  readonly stepIndex: number
  readonly totalIterations: number
}

// ============================================================================
// Log Events
// ============================================================================

export interface LogMessageEvent extends DomainEvent {
  readonly type: 'log:message'
  readonly agentId: AgentId
  readonly message: string
  readonly level: 'debug' | 'info' | 'warn' | 'error'
}

export interface LogStreamEvent extends DomainEvent {
  readonly type: 'log:stream'
  readonly agentId: AgentId
  readonly chunk: string
  readonly position: number
}

// ============================================================================
// Monitoring Events
// ============================================================================

export interface MonitoringRegisteredEvent extends DomainEvent {
  readonly type: 'monitoring:registered'
  readonly agentId: AgentId
  readonly monitoringId: number
  readonly logPath: string
}

// ============================================================================
// Union Type of All Events
// ============================================================================

export type WorkflowEvent =
  | WorkflowStartedEvent
  | WorkflowStatusChangedEvent
  | WorkflowStoppedEvent
  | WorkflowPausedEvent
  | WorkflowResumedEvent
  | WorkflowErrorEvent

export type StepEvent =
  | StepStartedEvent
  | StepCompletedEvent
  | StepSkippedEvent
  | StepErrorEvent

export type AgentEvent =
  | AgentAddedEvent
  | AgentStatusChangedEvent
  | AgentTelemetryEvent
  | AgentOutputEvent
  | AgentSessionEvent

export type SubAgentEvent =
  | SubAgentAddedEvent
  | SubAgentBatchEvent
  | SubAgentStatusChangedEvent

export type InputEvent =
  | InputRequestedEvent
  | InputReceivedEvent
  | InputModeChangedEvent

export type CheckpointEvent =
  | CheckpointCreatedEvent
  | CheckpointResolvedEvent

export type LoopEvent =
  | LoopStartedEvent
  | LoopCompletedEvent

export type LogEvent =
  | LogMessageEvent
  | LogStreamEvent

export type AllDomainEvents =
  | WorkflowEvent
  | StepEvent
  | AgentEvent
  | SubAgentEvent
  | InputEvent
  | CheckpointEvent
  | LoopEvent
  | LogEvent
  | MonitoringRegisteredEvent

// ============================================================================
// Event Factory Functions
// ============================================================================

const createBaseEvent = (type: string, correlationId?: string): DomainEvent => ({
  type,
  timestamp: Date.now(),
  correlationId,
})

export const createEvent = {
  workflowStarted: (workflowId: WorkflowId, totalSteps: number, correlationId?: string): WorkflowStartedEvent => ({
    ...createBaseEvent('workflow:started', correlationId),
    type: 'workflow:started',
    workflowId,
    totalSteps,
  }),

  workflowStatusChanged: (
    workflowId: WorkflowId,
    previousStatus: WorkflowStatus,
    currentStatus: WorkflowStatus,
    stepIndex?: number,
    correlationId?: string
  ): WorkflowStatusChangedEvent => ({
    ...createBaseEvent('workflow:status-changed', correlationId),
    type: 'workflow:status-changed',
    workflowId,
    previousStatus,
    currentStatus,
    stepIndex,
  }),

  agentTelemetry: (agentId: AgentId, telemetry: Telemetry, cumulative = false, correlationId?: string): AgentTelemetryEvent => ({
    ...createBaseEvent('agent:telemetry', correlationId),
    type: 'agent:telemetry',
    agentId,
    telemetry,
    cumulative,
  }),

  inputRequested: (
    workflowId: WorkflowId,
    stepIndex: number,
    prompt?: string,
    chainedPrompts?: Array<{ name: string; label: string }>,
    correlationId?: string
  ): InputRequestedEvent => ({
    ...createBaseEvent('input:requested', correlationId),
    type: 'input:requested',
    workflowId,
    stepIndex,
    prompt,
    chainedPrompts,
  }),

  logStream: (agentId: AgentId, chunk: string, position: number, correlationId?: string): LogStreamEvent => ({
    ...createBaseEvent('log:stream', correlationId),
    type: 'log:stream',
    agentId,
    chunk,
    position,
  }),
}

// ============================================================================
// Event Type Guards
// ============================================================================

export const isWorkflowEvent = (event: DomainEvent): event is WorkflowEvent =>
  event.type.startsWith('workflow:')

export const isAgentEvent = (event: DomainEvent): event is AgentEvent =>
  event.type.startsWith('agent:')

export const isInputEvent = (event: DomainEvent): event is InputEvent =>
  event.type.startsWith('input:')
