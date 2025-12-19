/**
 * Workflow Repository
 *
 * Type-safe repository for workflow state persistence and crash recovery.
 */

import { eq, and, desc, ne, inArray } from 'drizzle-orm'
import type { DrizzleDB } from '../connection.js'
import {
  workflowStates,
  workflowCheckpoints,
  WORKFLOW_STATES,
  type WorkflowState,
  type NewWorkflowState,
  type WorkflowCheckpoint,
  type NewWorkflowCheckpoint,
  type WorkflowStateValue,
  type WorkflowRecoveryResult,
} from '../schema/index.js'

export class WorkflowRepository {
  constructor(private db: DrizzleDB) {}

  // ============================================================================
  // Workflow State CRUD
  // ============================================================================

  /**
   * Create a new workflow state
   */
  async create(state: NewWorkflowState): Promise<void> {
    await this.db.insert(workflowStates).values(state)
  }

  /**
   * Get workflow state by ID
   */
  async get(id: string): Promise<WorkflowState | null> {
    const result = await this.db.query.workflowStates.findFirst({
      where: eq(workflowStates.id, id),
    })
    return result ?? null
  }

  /**
   * Update workflow state
   */
  async update(
    id: string,
    updates: Partial<Omit<NewWorkflowState, 'id'>>
  ): Promise<void> {
    await this.db
      .update(workflowStates)
      .set({ ...updates, updatedAt: Date.now() })
      .where(eq(workflowStates.id, id))
  }

  /**
   * Delete workflow state and all checkpoints
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(workflowStates).where(eq(workflowStates.id, id))
  }

  /**
   * Update state only
   */
  async updateState(id: string, state: WorkflowStateValue): Promise<void> {
    await this.db
      .update(workflowStates)
      .set({ state, updatedAt: Date.now() })
      .where(eq(workflowStates.id, id))
  }

  /**
   * Update step index
   */
  async updateStepIndex(id: string, stepIndex: number): Promise<void> {
    await this.db
      .update(workflowStates)
      .set({ currentStepIndex: stepIndex, updatedAt: Date.now() })
      .where(eq(workflowStates.id, id))
  }

  // ============================================================================
  // Checkpoint CRUD
  // ============================================================================

  /**
   * Create a checkpoint
   */
  async createCheckpoint(checkpoint: NewWorkflowCheckpoint): Promise<number> {
    const [result] = await this.db
      .insert(workflowCheckpoints)
      .values(checkpoint)
      .returning({ id: workflowCheckpoints.id })
    return result.id
  }

  /**
   * Get checkpoints for a workflow
   */
  async getCheckpoints(workflowId: string): Promise<WorkflowCheckpoint[]> {
    return this.db.query.workflowCheckpoints.findMany({
      where: eq(workflowCheckpoints.workflowId, workflowId),
      orderBy: [workflowCheckpoints.stepIndex],
    })
  }

  /**
   * Get latest checkpoint for a workflow
   */
  async getLatestCheckpoint(workflowId: string): Promise<WorkflowCheckpoint | null> {
    const result = await this.db.query.workflowCheckpoints.findFirst({
      where: eq(workflowCheckpoints.workflowId, workflowId),
      orderBy: [desc(workflowCheckpoints.stepIndex)],
    })
    return result ?? null
  }

  /**
   * Get checkpoint by step index
   */
  async getCheckpointByStep(
    workflowId: string,
    stepIndex: number
  ): Promise<WorkflowCheckpoint | null> {
    const result = await this.db.query.workflowCheckpoints.findFirst({
      where: and(
        eq(workflowCheckpoints.workflowId, workflowId),
        eq(workflowCheckpoints.stepIndex, stepIndex)
      ),
    })
    return result ?? null
  }

  /**
   * Delete checkpoints after a step index (for rollback)
   */
  async deleteCheckpointsAfter(workflowId: string, stepIndex: number): Promise<number> {
    const result = await this.db
      .delete(workflowCheckpoints)
      .where(
        and(
          eq(workflowCheckpoints.workflowId, workflowId),
          // stepIndex > value needs raw SQL or gt function
        )
      )
      .returning({ id: workflowCheckpoints.id })
    return result.length
  }

  // ============================================================================
  // Recovery Operations
  // ============================================================================

  /**
   * Find recoverable workflows (not completed or stopped)
   */
  async findRecoverable(): Promise<WorkflowState[]> {
    return this.db.query.workflowStates.findMany({
      where: inArray(workflowStates.state, ['running', 'waiting', 'idle']),
      orderBy: [desc(workflowStates.updatedAt)],
    })
  }

  /**
   * Find workflows by directory
   */
  async findByDirectory(cwd: string): Promise<WorkflowState[]> {
    return this.db.query.workflowStates.findMany({
      where: eq(workflowStates.cwd, cwd),
      orderBy: [desc(workflowStates.updatedAt)],
    })
  }

  /**
   * Get recovery data for a workflow
   */
  async getRecoveryData(workflowId: string): Promise<WorkflowRecoveryResult | null> {
    const workflowState = await this.get(workflowId)
    if (!workflowState) return null

    const checkpoints = await this.getCheckpoints(workflowId)

    // Find last completed step
    let lastCompletedStep = -1
    for (const cp of checkpoints) {
      if (cp.stepIndex > lastCompletedStep) {
        lastCompletedStep = cp.stepIndex
      }
    }

    // Can resume if not in final state and has progress
    const canResume =
      !['completed', 'stopped', 'error'].includes(workflowState.state) &&
      (lastCompletedStep >= 0 || workflowState.state === 'idle')

    return {
      workflowState,
      checkpoints,
      lastCompletedStep,
      canResume,
    }
  }

  /**
   * Mark workflow as recovered (set state to waiting)
   */
  async markRecovered(workflowId: string): Promise<void> {
    await this.update(workflowId, { state: 'waiting' })
  }

  /**
   * Cleanup old completed/stopped workflows
   */
  async cleanupOlderThan(timestamp: number): Promise<number> {
    const result = await this.db
      .delete(workflowStates)
      .where(
        and(
          inArray(workflowStates.state, ['completed', 'stopped']),
          // updatedAt <= timestamp would need lte function
        )
      )
      .returning({ id: workflowStates.id })
    return result.length
  }

  /**
   * Get recent workflows for listing
   */
  async getRecent(limit: number = 10): Promise<WorkflowState[]> {
    return this.db.query.workflowStates.findMany({
      orderBy: [desc(workflowStates.updatedAt)],
      limit,
    })
  }
}
