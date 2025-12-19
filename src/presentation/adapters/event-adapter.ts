/**
 * TUI Event Adapter
 *
 * Translates domain events into UI state updates.
 * Bridges the gap between the domain layer and presentation layer.
 *
 * Features:
 * - Batched updates for performance (~60fps)
 * - Type-safe event handling
 * - Automatic store dispatch
 */

import type { Unsubscribe, AgentId } from '../../shared/types'
import type { IEventBus } from '../../infrastructure/events/event-bus'
import type {
  AllDomainEvents,
  WorkflowStartedEvent,
  WorkflowStatusChangedEvent,
  WorkflowStoppedEvent,
  WorkflowErrorEvent,
  StepStartedEvent,
  StepCompletedEvent,
  StepSkippedEvent,
  StepErrorEvent,
  AgentAddedEvent,
  AgentStatusChangedEvent,
  AgentTelemetryEvent,
  SubAgentAddedEvent,
  SubAgentBatchEvent,
  SubAgentStatusChangedEvent,
  InputRequestedEvent,
  InputModeChangedEvent,
  CheckpointCreatedEvent,
  LogStreamEvent,
} from '../../infrastructure/events/event-types'
import type { Store, Action } from '../store'

// ============================================================================
// Types
// ============================================================================

export interface EventAdapterConfig {
  /** Event bus to subscribe to */
  eventBus: IEventBus
  /** UI store to dispatch actions to */
  store: Store
  /** Batch interval in ms (default: 16 for ~60fps) */
  batchInterval?: number
  /** Enable debug logging */
  debug?: boolean
}

// ============================================================================
// Event Adapter Implementation
// ============================================================================

export class TUIEventAdapter {
  private readonly eventBus: IEventBus
  private readonly store: Store
  private readonly batchInterval: number
  private readonly debug: boolean

  private unsubscribes: Unsubscribe[] = []
  private pendingActions: Action[] = []
  private batchTimer: NodeJS.Timeout | null = null

  constructor(config: EventAdapterConfig) {
    this.eventBus = config.eventBus
    this.store = config.store
    this.batchInterval = config.batchInterval ?? 16
    this.debug = config.debug ?? false
  }

  /**
   * Start listening to domain events
   */
  start(): void {
    this.log('Starting event adapter')

    // Workflow events
    this.subscribe('workflow:started', this.handleWorkflowStarted.bind(this))
    this.subscribe('workflow:status-changed', this.handleWorkflowStatusChanged.bind(this))
    this.subscribe('workflow:stopped', this.handleWorkflowStopped.bind(this))
    this.subscribe('workflow:error', this.handleWorkflowError.bind(this))

    // Step events
    this.subscribe('step:started', this.handleStepStarted.bind(this))
    this.subscribe('step:completed', this.handleStepCompleted.bind(this))
    this.subscribe('step:skipped', this.handleStepSkipped.bind(this))
    this.subscribe('step:error', this.handleStepError.bind(this))

    // Agent events
    this.subscribe('agent:added', this.handleAgentAdded.bind(this))
    this.subscribe('agent:status-changed', this.handleAgentStatusChanged.bind(this))
    this.subscribe('agent:telemetry', this.handleAgentTelemetry.bind(this))

    // SubAgent events
    this.subscribe('subagent:added', this.handleSubAgentAdded.bind(this))
    this.subscribe('subagent:batch', this.handleSubAgentBatch.bind(this))
    this.subscribe('subagent:status-changed', this.handleSubAgentStatusChanged.bind(this))

    // Input events
    this.subscribe('input:requested', this.handleInputRequested.bind(this))
    this.subscribe('input:mode-changed', this.handleInputModeChanged.bind(this))

    // Checkpoint events
    this.subscribe('checkpoint:created', this.handleCheckpointCreated.bind(this))

    // Log events
    this.subscribe('log:stream', this.handleLogStream.bind(this))
  }

  /**
   * Stop listening to domain events
   */
  stop(): void {
    this.log('Stopping event adapter')

    // Flush any pending actions
    this.flush()

    // Unsubscribe from all events
    for (const unsub of this.unsubscribes) {
      unsub()
    }
    this.unsubscribes = []
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private handleWorkflowStarted(event: WorkflowStartedEvent): void {
    this.log('Workflow started', { totalSteps: event.totalSteps })

    this.queue({ type: 'WORKFLOW_START', totalSteps: event.totalSteps })
    this.queue({ type: 'AGENT_CLEAR_ALL' })
  }

  private handleWorkflowStatusChanged(event: WorkflowStatusChangedEvent): void {
    this.log('Workflow status changed', {
      from: event.previousStatus,
      to: event.currentStatus
    })

    this.queue({ type: 'WORKFLOW_SET_STATUS', status: event.currentStatus })

    if (event.stepIndex !== undefined) {
      this.queue({
        type: 'WORKFLOW_SET_STEP',
        stepIndex: event.stepIndex,
        totalSteps: this.store.getState().workflow.totalSteps,
      })
    }
  }

  private handleWorkflowStopped(event: WorkflowStoppedEvent): void {
    this.log('Workflow stopped', { reason: event.reason })

    const status = event.reason === 'completed' ? 'completed' : 'stopped'
    this.queue({ type: 'WORKFLOW_SET_STATUS', status })
  }

  private handleWorkflowError(event: WorkflowErrorEvent): void {
    this.log('Workflow error', { error: event.error.message })

    this.queue({ type: 'WORKFLOW_SET_STATUS', status: 'error' })
    this.queue({ type: 'MODAL_OPEN_ERROR', message: event.error.message })
  }

  private handleStepStarted(event: StepStartedEvent): void {
    this.log('Step started', { stepIndex: event.stepIndex, agent: event.agentName })

    // Add agent to UI
    this.queue({
      type: 'AGENT_ADD',
      agent: {
        id: event.agentId,
        name: event.agentName,
        engine: 'claude', // Will be updated by agent:added event
        status: 'running',
        stepIndex: event.stepIndex,
        telemetry: { tokensIn: 0, tokensOut: 0, cost: 0 },
        duration: 0,
      },
    })

    // Select the new agent
    this.queue({ type: 'AGENT_SELECT', agentId: event.agentId })
  }

  private handleStepCompleted(event: StepCompletedEvent): void {
    this.log('Step completed', { stepIndex: event.stepIndex })

    // Update agent status
    const state = this.store.getState()
    const agent = state.agents.agents.find(a => a.stepIndex === event.stepIndex)

    if (agent) {
      this.queue({ type: 'AGENT_UPDATE_STATUS', agentId: agent.id, status: 'completed' })
      this.queue({ type: 'AGENT_UPDATE_DURATION', agentId: agent.id, duration: event.duration })
    }

    // Clear input state
    this.queue({ type: 'INPUT_CLEAR' })
  }

  private handleStepSkipped(event: StepSkippedEvent): void {
    this.log('Step skipped', { stepIndex: event.stepIndex, reason: event.reason })

    const state = this.store.getState()
    const agent = state.agents.agents.find(a => a.stepIndex === event.stepIndex)

    if (agent) {
      this.queue({ type: 'AGENT_UPDATE_STATUS', agentId: agent.id, status: 'skipped' })
    }

    this.queue({ type: 'INPUT_CLEAR' })
  }

  private handleStepError(event: StepErrorEvent): void {
    this.log('Step error', { stepIndex: event.stepIndex, error: event.error.message })

    const state = this.store.getState()
    const agent = state.agents.agents.find(a => a.stepIndex === event.stepIndex)

    if (agent) {
      this.queue({ type: 'AGENT_UPDATE_STATUS', agentId: agent.id, status: 'error' })
    }
  }

  private handleAgentAdded(event: AgentAddedEvent): void {
    this.log('Agent added', { agentId: event.agentId, name: event.name })

    this.queue({
      type: 'AGENT_ADD',
      agent: {
        id: event.agentId,
        name: event.name,
        engine: event.engine,
        status: 'pending',
        stepIndex: event.stepIndex,
        telemetry: { tokensIn: 0, tokensOut: 0, cost: 0 },
        duration: 0,
      },
    })
  }

  private handleAgentStatusChanged(event: AgentStatusChangedEvent): void {
    this.log('Agent status changed', {
      agentId: event.agentId,
      status: event.currentStatus
    })

    this.queue({
      type: 'AGENT_UPDATE_STATUS',
      agentId: event.agentId,
      status: event.currentStatus,
    })
  }

  private handleAgentTelemetry(event: AgentTelemetryEvent): void {
    this.log('Agent telemetry', { agentId: event.agentId })

    this.queue({
      type: 'AGENT_UPDATE_TELEMETRY',
      agentId: event.agentId,
      telemetry: event.telemetry,
    })

    // Also update workflow telemetry
    if (event.cumulative) {
      this.queue({
        type: 'WORKFLOW_ADD_TELEMETRY',
        telemetry: event.telemetry,
      })
    }
  }

  private handleSubAgentAdded(event: SubAgentAddedEvent): void {
    this.log('SubAgent added', {
      parentId: event.parentAgentId,
      subAgentId: event.subAgentId
    })

    this.queue({
      type: 'SUBAGENT_ADD',
      parentId: event.parentAgentId,
      subAgent: {
        id: event.subAgentId,
        name: event.name,
        parentId: event.parentAgentId,
        status: 'pending',
        model: event.model ?? null,
      },
    })
  }

  private handleSubAgentBatch(event: SubAgentBatchEvent): void {
    this.log('SubAgent batch', {
      parentId: event.parentAgentId,
      count: event.subAgents.length
    })

    this.queue({
      type: 'SUBAGENT_BATCH_ADD',
      parentId: event.parentAgentId,
      subAgents: event.subAgents.map(sub => ({
        id: sub.id,
        name: sub.name,
        parentId: event.parentAgentId,
        status: sub.status,
        model: sub.model ?? null,
      })),
    })
  }

  private handleSubAgentStatusChanged(event: SubAgentStatusChangedEvent): void {
    this.log('SubAgent status changed', {
      subAgentId: event.subAgentId,
      status: event.status
    })

    this.queue({
      type: 'SUBAGENT_UPDATE_STATUS',
      parentId: event.parentAgentId,
      subAgentId: event.subAgentId,
      status: event.status,
    })
  }

  private handleInputRequested(event: InputRequestedEvent): void {
    this.log('Input requested', { stepIndex: event.stepIndex })

    this.queue({
      type: 'INPUT_SET_WAITING',
      isWaiting: true,
      prompt: event.prompt,
    })

    if (event.chainedPrompts) {
      this.queue({
        type: 'INPUT_SET_CHAINED',
        prompts: event.chainedPrompts,
      })
    }
  }

  private handleInputModeChanged(event: InputModeChangedEvent): void {
    this.log('Input mode changed', {
      from: event.previousMode,
      to: event.currentMode
    })

    this.queue({
      type: 'WORKFLOW_SET_MODE',
      mode: event.currentMode,
    })
  }

  private handleCheckpointCreated(event: CheckpointCreatedEvent): void {
    this.log('Checkpoint created', { message: event.message })

    this.queue({
      type: 'MODAL_OPEN_CHECKPOINT',
      message: event.message,
    })
  }

  private handleLogStream(event: LogStreamEvent): void {
    // Log streaming is handled separately by the log viewer
    // This is just for tracking purposes
  }

  // ============================================================================
  // Batching Logic
  // ============================================================================

  private queue(action: Action): void {
    this.pendingActions.push(action)

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), this.batchInterval)
    }
  }

  private flush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    if (this.pendingActions.length === 0) {
      return
    }

    // Dispatch all actions as a batch
    this.store.dispatch({
      type: 'BATCH',
      actions: this.pendingActions,
    })

    this.pendingActions = []
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private subscribe<T extends AllDomainEvents>(
    type: T['type'],
    handler: (event: T) => void
  ): void {
    const unsub = this.eventBus.subscribe(type, handler as any)
    this.unsubscribes.push(unsub)
  }

  private log(message: string, context?: Record<string, unknown>): void {
    if (this.debug) {
      console.log(`[EventAdapter] ${message}`, context ?? '')
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export const createEventAdapter = (config: EventAdapterConfig): TUIEventAdapter => {
  return new TUIEventAdapter(config)
}
