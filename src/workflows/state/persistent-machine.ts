/**
 * Persistent State Machine
 *
 * Decorates the workflow state machine to persist state to SQLite.
 * Enables crash recovery and workflow resumption.
 */

import { getDatabase, type DrizzleDB } from '../../infrastructure/database/connection.js'
import { WorkflowRepository } from '../../infrastructure/database/repositories/workflow.repository.js'
import type {
  NewWorkflowState,
  NewWorkflowCheckpoint,
  WorkflowStateValue,
  PersistedWorkflowContext,
  WorkflowRecoveryResult,
} from '../../infrastructure/database/schema/index.js'
import { debug } from '../../shared/logging/logger.js'
import type {
  StateMachine,
  WorkflowState,
  WorkflowEvent,
  WorkflowContext,
  StateListener,
} from './types.js'
import { createWorkflowMachine } from './machine.js'

// ============================================================================
// Types
// ============================================================================

export interface PersistentMachineConfig {
  /** Unique workflow ID */
  workflowId: string
  /** CM root directory */
  cmRoot: string
  /** Current working directory */
  cwd: string
  /** Database instance */
  db?: DrizzleDB
  /** Initial context overrides */
  initialContext?: Partial<WorkflowContext>
  /** Template ID for reference */
  templateId?: string
  /** Project name */
  projectName?: string
}

export interface RecoveryOptions {
  /** Resume from last checkpoint */
  resume?: boolean
  /** Step index to resume from (overrides last checkpoint) */
  resumeFrom?: number
}

// ============================================================================
// Persistent Machine Implementation
// ============================================================================

export class PersistentMachine implements StateMachine {
  private inner: StateMachine
  private repository: WorkflowRepository
  private workflowId: string
  private cmRoot: string
  private cwd: string
  private templateId?: string
  private projectName?: string
  private initialized = false

  constructor(config: PersistentMachineConfig) {
    const db = config.db ?? getDatabase()
    this.repository = new WorkflowRepository(db)
    this.workflowId = config.workflowId
    this.cmRoot = config.cmRoot
    this.cwd = config.cwd
    this.templateId = config.templateId
    this.projectName = config.projectName

    // Create inner state machine
    this.inner = createWorkflowMachine({
      ...config.initialContext,
      cmRoot: config.cmRoot,
      cwd: config.cwd,
    })

    // Subscribe to persist state changes
    this.inner.subscribe((state, context) => {
      this.persistState(state, context)
    })
  }

  // ============================================================================
  // StateMachine Interface
  // ============================================================================

  get state(): WorkflowState {
    return this.inner.state
  }

  get context(): WorkflowContext {
    return this.inner.context
  }

  get isFinal(): boolean {
    return this.inner.isFinal
  }

  send(event: WorkflowEvent): void {
    const prevState = this.inner.state
    const prevStepIndex = this.inner.context.currentStepIndex

    this.inner.send(event)

    // Create checkpoint on step completion
    if (event.type === 'STEP_COMPLETE') {
      this.createCheckpoint(prevStepIndex, event.output)
    }
  }

  subscribe(listener: StateListener): () => void {
    return this.inner.subscribe(listener)
  }

  // ============================================================================
  // Persistence Methods
  // ============================================================================

  /**
   * Initialize persistence (creates or loads workflow state)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const existing = await this.repository.get(this.workflowId)
    if (!existing) {
      // Create new workflow state
      const newState: NewWorkflowState = {
        id: this.workflowId,
        state: this.inner.state as WorkflowStateValue,
        currentStepIndex: this.inner.context.currentStepIndex,
        totalSteps: this.inner.context.totalSteps,
        autoMode: this.inner.context.autoMode,
        cmRoot: this.cmRoot,
        cwd: this.cwd,
        startedAt: Date.now(),
        updatedAt: Date.now(),
        context: this.serializeContext(),
      }

      await this.repository.create(newState)
      debug('[PersistentMachine] Created workflow state: %s', this.workflowId)
    }

    this.initialized = true
  }

  /**
   * Persist current state to SQLite
   */
  private persistState(state: WorkflowState, context: WorkflowContext): void {
    if (!this.initialized) return

    // Fire and forget - don't block state transitions
    void this.repository
      .update(this.workflowId, {
        state: state as WorkflowStateValue,
        currentStepIndex: context.currentStepIndex,
        totalSteps: context.totalSteps,
        autoMode: context.autoMode,
        context: this.serializeContext(),
      })
      .catch((err) => {
        console.error('[PersistentMachine] Failed to persist state:', err)
      })
  }

  /**
   * Create a checkpoint after step completion
   */
  private createCheckpoint(
    stepIndex: number,
    output: { output: string; monitoringId?: number; sessionId?: string }
  ): void {
    const checkpoint: NewWorkflowCheckpoint = {
      workflowId: this.workflowId,
      stepIndex,
      output: output.output,
      sessionId: output.sessionId ?? null,
      monitoringId: output.monitoringId ?? null,
      timestamp: Date.now(),
    }

    void this.repository.createCheckpoint(checkpoint).catch((err) => {
      console.error('[PersistentMachine] Failed to create checkpoint:', err)
    })
  }

  /**
   * Serialize context for storage
   */
  private serializeContext(): PersistedWorkflowContext {
    const ctx = this.inner.context
    return {
      templateId: this.templateId,
      projectName: this.projectName,
      promptQueue: ctx.promptQueue,
      error: ctx.lastError
        ? {
            message: ctx.lastError.message,
            stack: ctx.lastError.stack,
          }
        : undefined,
    }
  }

  // ============================================================================
  // Recovery Methods
  // ============================================================================

  /**
   * Get recovery data for this workflow
   */
  async getRecoveryData(): Promise<WorkflowRecoveryResult | null> {
    return this.repository.getRecoveryData(this.workflowId)
  }

  /**
   * Cleanup workflow state (call after completion)
   */
  async cleanup(): Promise<void> {
    if (this.isFinal) {
      await this.repository.delete(this.workflowId)
      debug('[PersistentMachine] Cleaned up workflow state: %s', this.workflowId)
    }
  }

  /**
   * Get the workflow ID
   */
  getWorkflowId(): string {
    return this.workflowId
  }
}

// ============================================================================
// Recovery Service
// ============================================================================

export class WorkflowRecoveryService {
  private repository: WorkflowRepository

  constructor(db?: DrizzleDB) {
    this.repository = new WorkflowRepository(db ?? getDatabase())
  }

  /**
   * Find all recoverable workflows
   */
  async findRecoverable(): Promise<WorkflowRecoveryResult[]> {
    const workflows = await this.repository.findRecoverable()
    const results: WorkflowRecoveryResult[] = []

    for (const workflow of workflows) {
      const recovery = await this.repository.getRecoveryData(workflow.id)
      if (recovery && recovery.canResume) {
        results.push(recovery)
      }
    }

    return results
  }

  /**
   * Find recoverable workflows in a directory
   */
  async findRecoverableInDirectory(cwd: string): Promise<WorkflowRecoveryResult[]> {
    const workflows = await this.repository.findByDirectory(cwd)
    const results: WorkflowRecoveryResult[] = []

    for (const workflow of workflows) {
      const recovery = await this.repository.getRecoveryData(workflow.id)
      if (recovery && recovery.canResume) {
        results.push(recovery)
      }
    }

    return results
  }

  /**
   * Recover a workflow and create a persistent machine
   */
  async recover(
    workflowId: string,
    options?: RecoveryOptions
  ): Promise<PersistentMachine | null> {
    const recovery = await this.repository.getRecoveryData(workflowId)
    if (!recovery || !recovery.canResume) {
      return null
    }

    const { workflowState, checkpoints, lastCompletedStep } = recovery

    // Parse stored context
    const storedContext = workflowState.context as PersistedWorkflowContext | null

    // Determine resume step
    let resumeStep = options?.resumeFrom ?? lastCompletedStep + 1
    if (options?.resume === false) {
      resumeStep = 0 // Start from beginning
    }

    // Create machine with recovered context
    const machine = new PersistentMachine({
      workflowId,
      cmRoot: workflowState.cmRoot,
      cwd: workflowState.cwd,
      templateId: storedContext?.templateId,
      projectName: storedContext?.projectName,
      initialContext: {
        currentStepIndex: resumeStep,
        totalSteps: workflowState.totalSteps,
        autoMode: workflowState.autoMode,
        promptQueue: (storedContext?.promptQueue ?? []) as WorkflowContext['promptQueue'],
      },
    })

    await machine.initialize()

    // Mark as recovered
    await this.repository.markRecovered(workflowId)

    debug(
      '[WorkflowRecovery] Recovered workflow %s at step %d/%d',
      workflowId,
      resumeStep,
      workflowState.totalSteps
    )

    return machine
  }

  /**
   * Get checkpoints for a workflow
   */
  async getCheckpoints(workflowId: string) {
    return this.repository.getCheckpoints(workflowId)
  }

  /**
   * Get recent workflows
   */
  async getRecentWorkflows(limit?: number) {
    return this.repository.getRecent(limit)
  }

  /**
   * Delete a workflow and its checkpoints
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.repository.delete(workflowId)
  }

  /**
   * Cleanup old completed workflows
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    return this.repository.cleanupOlderThan(cutoff)
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a persistent workflow machine
 */
export async function createPersistentMachine(
  config: PersistentMachineConfig
): Promise<PersistentMachine> {
  const machine = new PersistentMachine(config)
  await machine.initialize()
  return machine
}

/**
 * Get the workflow recovery service
 */
let recoveryService: WorkflowRecoveryService | null = null

export function getWorkflowRecoveryService(db?: DrizzleDB): WorkflowRecoveryService {
  if (!recoveryService) {
    recoveryService = new WorkflowRecoveryService(db)
  }
  return recoveryService
}
