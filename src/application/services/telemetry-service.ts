/**
 * Telemetry Service
 *
 * Aggregates and tracks metrics across workflows and agents.
 *
 * Features:
 * - Token usage tracking
 * - Cost calculation
 * - Cache hit tracking
 * - Duration tracking
 * - Per-step and aggregate metrics
 */

import type {
  AgentId,
  Telemetry,
  EngineName,
  Unsubscribe,
} from '../../shared/types'
import { createScopedLogger, type IStructuredLogger } from '../../shared/logging'
import type { IEventBus } from '../../infrastructure/events/event-bus'
import { getEventBus } from '../../infrastructure/events/event-bus'

// ============================================================================
// Types
// ============================================================================

export interface TelemetryServiceConfig {
  eventBus?: IEventBus
  logger?: IStructuredLogger
}

export interface StepTelemetry {
  readonly stepIndex: number
  readonly agentId: AgentId
  readonly agentName: string
  readonly engine: EngineName
  readonly telemetry: Telemetry
  readonly duration: number
  readonly startedAt: number
  readonly completedAt: number | null
}

export interface WorkflowTelemetry {
  readonly workflowId: string
  readonly totalSteps: number
  readonly completedSteps: number
  readonly aggregate: Telemetry
  readonly totalDuration: number
  readonly startedAt: number
  readonly completedAt: number | null
  readonly steps: StepTelemetry[]
}

export interface TelemetrySnapshot {
  readonly workflow: WorkflowTelemetry | null
  readonly currentStep: StepTelemetry | null
  readonly perEngine: Map<EngineName, Telemetry>
}

// ============================================================================
// Cost Calculation
// ============================================================================

// Approximate costs per 1M tokens (as of 2024)
const ENGINE_COSTS: Record<EngineName, { input: number; output: number }> = {
  claude: { input: 3.0, output: 15.0 },
  cursor: { input: 0.0, output: 0.0 }, // Included in subscription
  codex: { input: 2.0, output: 6.0 },
  ccr: { input: 3.0, output: 15.0 },
  auggie: { input: 0.0, output: 0.0 },
  opencode: { input: 2.0, output: 6.0 },
  gemini: { input: 0.5, output: 1.5 },
}

export const calculateCost = (
  engine: EngineName,
  tokensIn: number,
  tokensOut: number
): number => {
  const costs = ENGINE_COSTS[engine] ?? { input: 0, output: 0 }
  const inputCost = (tokensIn / 1_000_000) * costs.input
  const outputCost = (tokensOut / 1_000_000) * costs.output
  return inputCost + outputCost
}

// ============================================================================
// Telemetry Service Implementation
// ============================================================================

export class TelemetryService {
  private readonly logger: IStructuredLogger
  private readonly eventBus: IEventBus

  private workflowTelemetry: WorkflowTelemetry | null = null
  private stepTelemetry = new Map<number, StepTelemetry>()
  private engineTelemetry = new Map<EngineName, Telemetry>()
  private unsubscribes: Unsubscribe[] = []

  constructor(config: TelemetryServiceConfig = {}) {
    this.logger = config.logger ?? createScopedLogger('telemetry-service')
    this.eventBus = config.eventBus ?? getEventBus()
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Start tracking telemetry
   */
  start(): void {
    this.logger.debug('Starting telemetry tracking')

    // Subscribe to relevant events
    this.subscribeToEvents()
  }

  /**
   * Stop tracking and cleanup
   */
  stop(): void {
    this.logger.debug('Stopping telemetry tracking')

    for (const unsub of this.unsubscribes) {
      unsub()
    }
    this.unsubscribes = []
  }

  /**
   * Reset all telemetry
   */
  reset(): void {
    this.workflowTelemetry = null
    this.stepTelemetry.clear()
    this.engineTelemetry.clear()
  }

  // ============================================================================
  // Workflow Telemetry
  // ============================================================================

  /**
   * Initialize workflow telemetry
   */
  initWorkflow(workflowId: string, totalSteps: number): void {
    this.workflowTelemetry = {
      workflowId,
      totalSteps,
      completedSteps: 0,
      aggregate: { tokensIn: 0, tokensOut: 0, cost: 0, cached: 0 },
      totalDuration: 0,
      startedAt: Date.now(),
      completedAt: null,
      steps: [],
    }
  }

  /**
   * Mark workflow as completed
   */
  completeWorkflow(): void {
    if (this.workflowTelemetry) {
      this.workflowTelemetry = {
        ...this.workflowTelemetry,
        completedAt: Date.now(),
        totalDuration: Date.now() - this.workflowTelemetry.startedAt,
      }
    }
  }

  /**
   * Get workflow telemetry
   */
  getWorkflowTelemetry(): WorkflowTelemetry | null {
    return this.workflowTelemetry
  }

  // ============================================================================
  // Step Telemetry
  // ============================================================================

  /**
   * Start tracking a step
   */
  startStep(
    stepIndex: number,
    agentId: AgentId,
    agentName: string,
    engine: EngineName
  ): void {
    const step: StepTelemetry = {
      stepIndex,
      agentId,
      agentName,
      engine,
      telemetry: { tokensIn: 0, tokensOut: 0, cost: 0, cached: 0 },
      duration: 0,
      startedAt: Date.now(),
      completedAt: null,
    }

    this.stepTelemetry.set(stepIndex, step)
  }

  /**
   * Add telemetry to a step
   */
  addStepTelemetry(stepIndex: number, telemetry: Partial<Telemetry>): void {
    const step = this.stepTelemetry.get(stepIndex)
    if (!step) {
      return
    }

    const updatedTelemetry: Telemetry = {
      tokensIn: step.telemetry.tokensIn + (telemetry.tokensIn ?? 0),
      tokensOut: step.telemetry.tokensOut + (telemetry.tokensOut ?? 0),
      cost: step.telemetry.cost + (telemetry.cost ?? 0),
      cached: (step.telemetry.cached ?? 0) + (telemetry.cached ?? 0),
    }

    this.stepTelemetry.set(stepIndex, {
      ...step,
      telemetry: updatedTelemetry,
    })

    // Update workflow aggregate
    this.updateWorkflowAggregate(telemetry)

    // Update engine aggregate
    this.updateEngineAggregate(step.engine, telemetry)
  }

  /**
   * Complete a step
   */
  completeStep(stepIndex: number): void {
    const step = this.stepTelemetry.get(stepIndex)
    if (!step) {
      return
    }

    const completedAt = Date.now()
    const updatedStep: StepTelemetry = {
      ...step,
      completedAt,
      duration: completedAt - step.startedAt,
    }

    this.stepTelemetry.set(stepIndex, updatedStep)

    // Add to workflow steps
    if (this.workflowTelemetry) {
      this.workflowTelemetry = {
        ...this.workflowTelemetry,
        completedSteps: this.workflowTelemetry.completedSteps + 1,
        steps: [...this.workflowTelemetry.steps, updatedStep],
        totalDuration: Date.now() - this.workflowTelemetry.startedAt,
      }
    }
  }

  /**
   * Get step telemetry
   */
  getStepTelemetry(stepIndex: number): StepTelemetry | undefined {
    return this.stepTelemetry.get(stepIndex)
  }

  // ============================================================================
  // Engine Telemetry
  // ============================================================================

  /**
   * Get telemetry by engine
   */
  getEngineTelemetry(engine: EngineName): Telemetry {
    return this.engineTelemetry.get(engine) ?? { tokensIn: 0, tokensOut: 0, cost: 0, cached: 0 }
  }

  /**
   * Get all engine telemetry
   */
  getAllEngineTelemetry(): Map<EngineName, Telemetry> {
    return new Map(this.engineTelemetry)
  }

  // ============================================================================
  // Snapshots
  // ============================================================================

  /**
   * Get a snapshot of all telemetry
   */
  getSnapshot(): TelemetrySnapshot {
    const currentStepIndex = this.workflowTelemetry
      ? this.workflowTelemetry.completedSteps
      : 0

    return {
      workflow: this.workflowTelemetry,
      currentStep: this.stepTelemetry.get(currentStepIndex) ?? null,
      perEngine: this.getAllEngineTelemetry(),
    }
  }

  /**
   * Get formatted summary
   */
  getSummary(): string {
    if (!this.workflowTelemetry) {
      return 'No telemetry available'
    }

    const { aggregate, totalDuration, completedSteps, totalSteps } = this.workflowTelemetry

    const lines = [
      `Progress: ${completedSteps}/${totalSteps} steps`,
      `Duration: ${this.formatDuration(totalDuration)}`,
      `Tokens: ${this.formatNumber(aggregate.tokensIn)} in / ${this.formatNumber(aggregate.tokensOut)} out`,
      `Cost: $${aggregate.cost.toFixed(4)}`,
    ]

    if (aggregate.cached && aggregate.cached > 0) {
      lines.push(`Cached: ${this.formatNumber(aggregate.cached)} tokens`)
    }

    return lines.join(' | ')
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private subscribeToEvents(): void {
    // Listen to workflow events
    this.unsubscribes.push(
      this.eventBus.subscribe('workflow:started', (event) => {
        this.initWorkflow(event.workflowId, event.totalSteps)
      })
    )

    this.unsubscribes.push(
      this.eventBus.subscribe('workflow:stopped', (event) => {
        if (event.reason === 'completed') {
          this.completeWorkflow()
        }
      })
    )

    // Listen to step events
    this.unsubscribes.push(
      this.eventBus.subscribe('step:started', (event) => {
        this.startStep(
          event.stepIndex,
          event.agentId,
          event.agentName,
          'claude' as EngineName // Default, will be updated
        )
      })
    )

    this.unsubscribes.push(
      this.eventBus.subscribe('step:completed', (event) => {
        this.completeStep(event.stepIndex)
      })
    )

    // Listen to agent telemetry
    this.unsubscribes.push(
      this.eventBus.subscribe('agent:telemetry', (event) => {
        // Find which step this agent belongs to
        for (const [stepIndex, step] of this.stepTelemetry) {
          if (step.agentId === event.agentId) {
            this.addStepTelemetry(stepIndex, event.telemetry)
            break
          }
        }
      })
    )
  }

  private updateWorkflowAggregate(telemetry: Partial<Telemetry>): void {
    if (!this.workflowTelemetry) {
      return
    }

    this.workflowTelemetry = {
      ...this.workflowTelemetry,
      aggregate: {
        tokensIn: this.workflowTelemetry.aggregate.tokensIn + (telemetry.tokensIn ?? 0),
        tokensOut: this.workflowTelemetry.aggregate.tokensOut + (telemetry.tokensOut ?? 0),
        cost: this.workflowTelemetry.aggregate.cost + (telemetry.cost ?? 0),
        cached: (this.workflowTelemetry.aggregate.cached ?? 0) + (telemetry.cached ?? 0),
      },
    }
  }

  private updateEngineAggregate(engine: EngineName, telemetry: Partial<Telemetry>): void {
    const existing = this.engineTelemetry.get(engine) ?? {
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      cached: 0,
    }

    this.engineTelemetry.set(engine, {
      tokensIn: existing.tokensIn + (telemetry.tokensIn ?? 0),
      tokensOut: existing.tokensOut + (telemetry.tokensOut ?? 0),
      cost: existing.cost + (telemetry.cost ?? 0),
      cached: (existing.cached ?? 0) + (telemetry.cached ?? 0),
    })
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) {
      return `${(n / 1_000_000).toFixed(1)}M`
    }
    if (n >= 1_000) {
      return `${(n / 1_000).toFixed(1)}K`
    }
    return n.toString()
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let telemetryService: TelemetryService | null = null

export const getTelemetryService = (): TelemetryService => {
  if (!telemetryService) {
    telemetryService = new TelemetryService()
  }
  return telemetryService
}

export const resetTelemetryService = (): void => {
  telemetryService?.reset()
  telemetryService = null
}

// ============================================================================
// Factory Function
// ============================================================================

export const createTelemetryService = (config?: TelemetryServiceConfig): TelemetryService => {
  return new TelemetryService(config)
}
