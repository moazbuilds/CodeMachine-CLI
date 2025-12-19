/**
 * Workflow Service
 *
 * Main application layer orchestrator.
 * Coordinates between domain logic, infrastructure, and presentation.
 *
 * Responsibilities:
 * - Execute effects from state machine
 * - Coordinate input providers
 * - Manage workflow lifecycle
 * - Handle persistence
 * - Emit events for UI updates
 */

import type {
  WorkflowId,
  StepConfig,
  InputMode,
  Unsubscribe,
  Result,
} from '../../shared/types'
import { ok, err } from '../../shared/types'
import { createScopedLogger, type IStructuredLogger } from '../../shared/logging'
import {
  WorkflowAlreadyRunningError,
  WorkflowInvalidStateError,
  WorkflowExecutionError,
} from '../../shared/errors'

// Domain imports
import {
  transition,
  createInterpreter,
  type WorkflowContext,
  type Effect,
  type StateMachineInterpreter,
} from '../../domain/workflow/state-machine'
import { type WorkflowState, createIdleState, isFinal } from '../../domain/workflow/state-machine/states'
import { createEvent, type WorkflowEvent } from '../../domain/workflow/state-machine/events'
import { InputOrchestrator, type InputOrchestratorConfig } from '../../domain/input/input-orchestrator'

// Infrastructure imports
import { type IEventBus, getEventBus } from '../../infrastructure/events/event-bus'
import { createEvent as createDomainEvent } from '../../infrastructure/events/event-types'
import { type IStateStore, createStateStore } from '../../infrastructure/persistence/state-store'

// Application imports
import { getResumeService, type ResumeResult } from './resume-service'

// ============================================================================
// Types
// ============================================================================

export interface WorkflowServiceConfig {
  /** Working directory */
  cwd: string
  /** CodeMachine root directory */
  cmRoot: string
  /** Initial input mode */
  initialMode: InputMode
  /** Event bus instance (optional, uses global if not provided) */
  eventBus?: IEventBus
  /** State store instance (optional, creates new if not provided) */
  stateStore?: IStateStore
  /** Logger instance (optional, creates scoped logger if not provided) */
  logger?: IStructuredLogger
}

export interface WorkflowServiceState {
  readonly isRunning: boolean
  readonly isPaused: boolean
  readonly currentStepIndex: number
  readonly totalSteps: number
  readonly mode: InputMode
  readonly workflowState: WorkflowState
}

export interface StartOptions {
  steps: StepConfig[]
  workflowId?: WorkflowId
  startFromStep?: number
  resumeIfPossible?: boolean
}

// ============================================================================
// Workflow Service Implementation
// ============================================================================

export class WorkflowService {
  private readonly config: WorkflowServiceConfig
  private readonly logger: IStructuredLogger
  private readonly eventBus: IEventBus
  private stateStore: IStateStore | null = null

  private interpreter: StateMachineInterpreter | null = null
  private inputOrchestrator: InputOrchestrator | null = null
  private context: WorkflowContext | null = null
  private abortController: AbortController | null = null

  private isExecuting = false
  private workflowId: WorkflowId | null = null

  constructor(config: WorkflowServiceConfig) {
    this.config = config
    this.logger = config.logger ?? createScopedLogger('workflow-service')
    this.eventBus = config.eventBus ?? getEventBus()
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start a new workflow
   */
  async start(options: StartOptions): Promise<Result<void, Error>> {
    if (this.isExecuting) {
      return err(new WorkflowAlreadyRunningError(this.workflowId ?? 'unknown'))
    }

    this.logger.info('Starting workflow', {
      steps: options.steps.length,
      startFromStep: options.startFromStep,
      resume: options.resumeIfPossible,
    })

    try {
      // Initialize state store
      const storeResult = await createStateStore({
        dataDir: this.config.cmRoot,
      })

      if (!storeResult.ok) {
        return err(storeResult.error)
      }

      this.stateStore = storeResult.value

      // Recover from any previous state
      await this.stateStore.recover()

      // Set up workflow ID
      this.workflowId = (options.workflowId ?? `wf_${Date.now()}`) as WorkflowId

      // Create context
      this.context = {
        steps: options.steps,
        mode: this.config.initialMode,
        cwd: this.config.cwd,
        now: Date.now(),
      }

      // Determine starting point
      let startStep = options.startFromStep ?? 0

      if (options.resumeIfPossible) {
        const resumeResult = await this.determineResumePoint(options.steps)
        if (resumeResult) {
          startStep = resumeResult.stepIndex
          this.logger.info('Resuming workflow', {
            strategy: resumeResult.strategy.type,
            stepIndex: startStep,
          })
        }
      }

      // Create interpreter with initial state
      const initialState = createIdleState()
      this.interpreter = createInterpreter(initialState, this.context)

      // Set up abort controller
      this.abortController = new AbortController()

      // Start execution
      this.isExecuting = true

      // Send START event
      const startEvent = createEvent.start(options.steps, startStep)
      const result = this.interpreter.send(startEvent)

      if (!result.valid) {
        return err(new WorkflowExecutionError(result.invalidReason ?? 'Failed to start', 0))
      }

      // Execute effects
      await this.executeEffects(result.effects)

      // Emit workflow started event
      this.eventBus.emit(
        createDomainEvent.workflowStarted(this.workflowId, options.steps.length)
      )

      // Run main loop
      this.runMainLoop().catch((error) => {
        this.logger.error('Main loop error', error as Error)
        this.handleFatalError(error as Error)
      })

      return ok(undefined)
    } catch (error) {
      this.isExecuting = false
      return err(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Pause the workflow
   */
  async pause(reason: string = 'user requested'): Promise<Result<void, Error>> {
    if (!this.isExecuting || !this.interpreter) {
      return err(new WorkflowInvalidStateError('not running', ['running', 'waiting'], 'pause'))
    }

    this.logger.info('Pausing workflow', { reason })

    const event = createEvent.pause(reason)
    const result = this.interpreter.send(event)

    if (!result.valid) {
      return err(new WorkflowInvalidStateError(
        this.interpreter.getState().status,
        ['running', 'waiting'],
        'pause'
      ))
    }

    await this.executeEffects(result.effects)

    return ok(undefined)
  }

  /**
   * Resume the workflow
   */
  async resume(): Promise<Result<void, Error>> {
    if (!this.interpreter) {
      return err(new WorkflowInvalidStateError('not initialized', ['paused'], 'resume'))
    }

    const state = this.interpreter.getState()
    if (state.status !== 'paused') {
      return err(new WorkflowInvalidStateError(state.status, ['paused'], 'resume'))
    }

    this.logger.info('Resuming workflow')

    const stepIndex = 'stepIndex' in state ? state.stepIndex : 0
    const event = createEvent.resume(stepIndex)
    const result = this.interpreter.send(event)

    if (!result.valid) {
      return err(new WorkflowInvalidStateError(state.status, ['paused'], 'resume'))
    }

    await this.executeEffects(result.effects)

    // Restart main loop if not running
    if (!this.isExecuting) {
      this.isExecuting = true
      this.runMainLoop().catch((error) => {
        this.logger.error('Main loop error after resume', error as Error)
        this.handleFatalError(error as Error)
      })
    }

    return ok(undefined)
  }

  /**
   * Stop the workflow
   */
  async stop(reason: 'user' | 'error' | 'timeout' = 'user'): Promise<Result<void, Error>> {
    if (!this.interpreter) {
      return err(new WorkflowInvalidStateError('not initialized', ['running', 'waiting', 'paused'], 'stop'))
    }

    this.logger.info('Stopping workflow', { reason })

    // Abort any pending operations
    this.abortController?.abort()

    const event = createEvent.stop(reason)
    const result = this.interpreter.send(event)

    if (!result.valid) {
      // Force stop anyway
      this.isExecuting = false
      return ok(undefined)
    }

    await this.executeEffects(result.effects)
    this.isExecuting = false

    return ok(undefined)
  }

  /**
   * Skip the current step
   */
  async skip(reason: string = 'user skipped'): Promise<Result<void, Error>> {
    if (!this.interpreter || !this.context) {
      return err(new WorkflowInvalidStateError('not initialized', ['running', 'waiting'], 'skip'))
    }

    const state = this.interpreter.getState()
    const stepIndex = 'stepIndex' in state ? state.stepIndex : 0

    this.logger.info('Skipping step', { stepIndex, reason })

    const event = createEvent.skip(stepIndex, reason)
    const result = this.interpreter.send(event)

    if (!result.valid) {
      return err(new WorkflowInvalidStateError(state.status, ['running', 'waiting'], 'skip'))
    }

    await this.executeEffects(result.effects)

    return ok(undefined)
  }

  /**
   * Switch input mode
   */
  async switchMode(mode: InputMode): Promise<Result<void, Error>> {
    if (!this.inputOrchestrator) {
      return err(new Error('Input orchestrator not initialized'))
    }

    this.logger.info('Switching mode', { mode })

    await this.inputOrchestrator.switchMode(mode)

    // Update context
    if (this.context) {
      this.context = { ...this.context, mode }
    }

    // Emit mode change event
    const previousMode = this.context?.mode ?? 'user'
    this.eventBus.emit({
      type: 'input:mode-changed',
      timestamp: Date.now(),
      workflowId: this.workflowId!,
      previousMode,
      currentMode: mode,
    })

    return ok(undefined)
  }

  /**
   * Get current service state
   */
  getState(): WorkflowServiceState {
    const workflowState = this.interpreter?.getState() ?? createIdleState()

    return {
      isRunning: this.isExecuting,
      isPaused: workflowState.status === 'paused',
      currentStepIndex: 'stepIndex' in workflowState ? workflowState.stepIndex : 0,
      totalSteps: this.context?.steps.length ?? 0,
      mode: this.context?.mode ?? 'user',
      workflowState,
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: WorkflowServiceState) => void): Unsubscribe {
    if (!this.interpreter) {
      return () => {}
    }

    return this.interpreter.subscribe(() => {
      listener(this.getState())
    })
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.abortController?.abort()
    await this.inputOrchestrator?.abort()
    await this.stateStore?.close()

    this.interpreter = null
    this.inputOrchestrator = null
    this.stateStore = null
    this.isExecuting = false
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Main execution loop
   */
  private async runMainLoop(): Promise<void> {
    while (this.isExecuting && this.interpreter && !this.abortController?.signal.aborted) {
      const state = this.interpreter.getState()

      // Check for final state
      if (isFinal(state)) {
        this.logger.info('Workflow reached final state', { status: state.status })
        this.isExecuting = false
        break
      }

      // Handle waiting state - get input
      if (state.status === 'waiting') {
        await this.handleWaitingState(state)
      }

      // Small delay to prevent tight loop
      await this.sleep(10)
    }
  }

  /**
   * Handle waiting state - get input from orchestrator
   */
  private async handleWaitingState(state: WorkflowState): Promise<void> {
    if (state.status !== 'waiting' || !this.inputOrchestrator || !this.interpreter) {
      return
    }

    try {
      const stepIndex = state.stepIndex

      // Get input from orchestrator
      const response = await this.inputOrchestrator.getInput({
        stepIndex,
        prompt: 'waitingFor' in state ? this.formatPrompt(state.waitingFor) : undefined,
      })

      // Process input action
      switch (response.action.type) {
        case 'continue': {
          const event = createEvent.inputReceived(stepIndex, response.input, response.source)
          const result = this.interpreter.send(event)
          if (result.valid) {
            await this.executeEffects(result.effects)
          }
          break
        }

        case 'skip': {
          const event = createEvent.skip(stepIndex, response.action.reason ?? 'user skipped')
          const result = this.interpreter.send(event)
          if (result.valid) {
            await this.executeEffects(result.effects)
          }
          break
        }

        case 'loop': {
          const currentState = this.interpreter.getState()
          const iteration = 'iteration' in currentState ? (currentState.iteration ?? 0) + 1 : 1
          const event = createEvent.loop(stepIndex, iteration)
          const result = this.interpreter.send(event)
          if (result.valid) {
            await this.executeEffects(result.effects)
          }
          break
        }

        case 'stop': {
          await this.stop('user')
          break
        }

        case 'switch-mode': {
          await this.switchMode(response.action.to)
          break
        }
      }
    } catch (error) {
      this.logger.error('Error handling waiting state', error as Error)
    }
  }

  /**
   * Execute effects from state transition
   */
  private async executeEffects(effects: Effect[]): Promise<void> {
    for (const effect of effects) {
      try {
        await this.executeEffect(effect)
      } catch (error) {
        this.logger.error('Effect execution error', error as Error, { effect: effect.type })
      }
    }
  }

  /**
   * Execute a single effect
   */
  private async executeEffect(effect: Effect): Promise<void> {
    switch (effect.type) {
      case 'PERSIST_STATE':
        await this.persistState(effect.state)
        break

      case 'EXECUTE_STEP':
        await this.executeStep(effect.stepIndex, effect.step)
        break

      case 'REQUEST_INPUT':
        this.emitInputRequest(effect.stepIndex, effect.prompt)
        break

      case 'EMIT_STATUS':
        this.emitStatusChange(effect.status, effect.stepIndex)
        break

      case 'EMIT_STEP_COMPLETE':
        this.emitStepComplete(effect.stepIndex, effect.output)
        break

      case 'EMIT_STEP_SKIP':
        this.emitStepSkip(effect.stepIndex, effect.reason)
        break

      case 'EMIT_STEP_ERROR':
        this.emitStepError(effect.stepIndex, effect.error)
        break

      case 'EMIT_WORKFLOW_COMPLETE':
        this.emitWorkflowComplete(effect.finalStep)
        break

      case 'EMIT_WORKFLOW_STOPPED':
        this.emitWorkflowStopped(effect.atStep, effect.reason)
        break

      case 'ABORT_CURRENT_STEP':
        this.abortController?.abort()
        this.abortController = new AbortController()
        break

      case 'SAVE_PAUSE_STATE':
        await this.savePauseState(effect.stepIndex)
        break

      case 'CLEAR_PAUSE_STATE':
        await this.clearPauseState()
        break

      case 'LOG':
        this.logger[effect.level](effect.message)
        break
    }
  }

  /**
   * Execute a step (placeholder - will integrate with agent system)
   */
  private async executeStep(stepIndex: number, step: StepConfig): Promise<void> {
    this.logger.info('Executing step', { stepIndex, agent: step.agentName })

    // Emit step started event
    this.eventBus.emit({
      type: 'step:started',
      timestamp: Date.now(),
      workflowId: this.workflowId!,
      stepIndex,
      stepId: `step_${stepIndex}` as any,
      agentId: step.agentId,
      agentName: step.agentName,
    })

    // TODO: Integrate with actual agent execution
    // For now, simulate completion after a delay
    await this.sleep(100)

    // Send step complete event to state machine
    if (this.interpreter) {
      const event = createEvent.stepComplete(stepIndex, 100)
      const result = this.interpreter.send(event)
      if (result.valid) {
        await this.executeEffects(result.effects)
      }
    }
  }

  /**
   * Determine resume point from persisted state
   */
  private async determineResumePoint(steps: StepConfig[]): Promise<ResumeResult | null> {
    if (!this.stateStore) {
      return null
    }

    // Get persisted workflow state
    const pausedAt = await this.stateStore.get<number>('workflow.pausedAt')
    const currentStepIndex = await this.stateStore.get<number>('workflow.currentStepIndex') ?? 0
    const notCompletedSteps = await this.stateStore.get<number[]>('workflow.notCompletedSteps') ?? []

    if (!pausedAt && notCompletedSteps.length === 0) {
      return null
    }

    // Build resume context
    const stepData = await Promise.all(
      steps.map(async (_, idx) => ({
        stepIndex: idx,
        sessionId: await this.stateStore!.get<string>(`step.${idx}.sessionId`) as any,
        monitoringId: await this.stateStore!.get<number>(`step.${idx}.monitoringId`) as any,
        completedChains: await this.stateStore!.get<number[]>(`step.${idx}.completedChains`) ?? [],
        startedAt: await this.stateStore!.get<number>(`step.${idx}.startedAt`),
        completedAt: await this.stateStore!.get<number>(`step.${idx}.completedAt`),
        skipped: await this.stateStore!.get<boolean>(`step.${idx}.skipped`) ?? false,
      }))
    )

    const resumeService = getResumeService()
    return resumeService.determineStrategy({
      currentStepIndex,
      totalSteps: steps.length,
      notCompletedSteps,
      pausedAt,
      autopilotWasActive: await this.stateStore.get<boolean>('workflow.autopilotActive') ?? false,
      fallbackAgentId: null,
      steps: stepData,
    })
  }

  // ============================================================================
  // State Persistence
  // ============================================================================

  private async persistState(state: WorkflowState): Promise<void> {
    if (!this.stateStore) return

    await this.stateStore.transaction((tx) => {
      tx.set('workflow.status', state.status)
      if ('stepIndex' in state) {
        tx.set('workflow.currentStepIndex', state.stepIndex)
      }
    })
  }

  private async savePauseState(stepIndex: number): Promise<void> {
    if (!this.stateStore) return

    await this.stateStore.transaction((tx) => {
      tx.set('workflow.pausedAt', Date.now())
      tx.set('workflow.currentStepIndex', stepIndex)
      tx.set('workflow.autopilotActive', this.context?.mode === 'autopilot')
    })
  }

  private async clearPauseState(): Promise<void> {
    if (!this.stateStore) return

    await this.stateStore.transaction((tx) => {
      tx.delete('workflow.pausedAt')
    })
  }

  // ============================================================================
  // Event Emission
  // ============================================================================

  private emitInputRequest(stepIndex: number, prompt?: string): void {
    this.eventBus.emit(
      createDomainEvent.inputRequested(this.workflowId!, stepIndex, prompt)
    )
  }

  private emitStatusChange(status: WorkflowState['status'], stepIndex?: number): void {
    // Status change event is handled by workflow:status-changed
  }

  private emitStepComplete(stepIndex: number, output?: string): void {
    this.eventBus.emit({
      type: 'step:completed',
      timestamp: Date.now(),
      workflowId: this.workflowId!,
      stepIndex,
      stepId: `step_${stepIndex}` as any,
      output,
      duration: 0,
    })
  }

  private emitStepSkip(stepIndex: number, reason: string): void {
    this.eventBus.emit({
      type: 'step:skipped',
      timestamp: Date.now(),
      workflowId: this.workflowId!,
      stepIndex,
      stepId: `step_${stepIndex}` as any,
      reason,
    })
  }

  private emitStepError(stepIndex: number, error: { code: string; message: string }): void {
    this.eventBus.emit({
      type: 'step:error',
      timestamp: Date.now(),
      workflowId: this.workflowId!,
      stepIndex,
      stepId: `step_${stepIndex}` as any,
      error,
    })
  }

  private emitWorkflowComplete(finalStep: number): void {
    this.eventBus.emit({
      type: 'workflow:stopped',
      timestamp: Date.now(),
      workflowId: this.workflowId!,
      reason: 'completed',
      finalStepIndex: finalStep,
    })
  }

  private emitWorkflowStopped(atStep: number, reason: string): void {
    this.eventBus.emit({
      type: 'workflow:stopped',
      timestamp: Date.now(),
      workflowId: this.workflowId!,
      reason: reason as 'user' | 'error' | 'completed',
      finalStepIndex: atStep,
    })
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private formatPrompt(waitingFor: any): string | undefined {
    if (!waitingFor) return undefined

    switch (waitingFor.type) {
      case 'user-input':
        return waitingFor.prompt
      case 'chained-prompt':
        return `Chain ${waitingFor.chainIndex + 1}`
      case 'checkpoint':
        return waitingFor.message
      case 'error-recovery':
        return `Error: ${waitingFor.error}. Retry or skip?`
      default:
        return undefined
    }
  }

  private handleFatalError(error: Error): void {
    this.logger.error('Fatal workflow error', error)
    this.isExecuting = false

    this.eventBus.emit({
      type: 'workflow:error',
      timestamp: Date.now(),
      workflowId: this.workflowId!,
      error: {
        code: 'FATAL_ERROR',
        message: error.message,
      },
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export const createWorkflowService = (config: WorkflowServiceConfig): WorkflowService => {
  return new WorkflowService(config)
}
