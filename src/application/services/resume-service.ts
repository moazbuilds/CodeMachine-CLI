/**
 * Unified Resume Service
 *
 * Consolidates ALL resume logic into a single service.
 * Eliminates scattered branching across multiple files.
 *
 * Resume Strategies (in priority order):
 * 1. Fallback-first: Run fallback agent before resuming
 * 2. Chain-resume: Resume from incomplete chained prompts
 * 3. Pause-resume: Resume from explicit user pause
 * 4. Crash-recovery: Resume from crash with last checkpoint
 * 5. Fresh: Start step from beginning
 */

import type {
  SessionId,
  AgentId,
  ResumeStrategy,
  ChainedPrompt,
} from '../../shared/types'
import { createScopedLogger } from '../../shared/logging'

// ============================================================================
// Types
// ============================================================================

export interface StepResumeData {
  readonly stepIndex: number
  readonly sessionId: SessionId | null
  readonly monitoringId: number | null
  readonly completedChains: number[]
  readonly startedAt: number | null
  readonly completedAt: number | null
  readonly skipped: boolean
}

export interface WorkflowResumeContext {
  readonly currentStepIndex: number
  readonly totalSteps: number
  readonly notCompletedSteps: number[]
  readonly pausedAt: number | null
  readonly autopilotWasActive: boolean
  readonly fallbackAgentId: AgentId | null
  readonly steps: StepResumeData[]
}

export interface ResumeResult {
  readonly strategy: ResumeStrategy
  readonly stepIndex: number
  readonly chainIndex?: number
  readonly sessionId?: SessionId
  readonly requiresFallback: boolean
  readonly message: string
}

// ============================================================================
// Resume Service Implementation
// ============================================================================

export class ResumeService {
  private readonly logger = createScopedLogger('resume')

  /**
   * Determine the appropriate resume strategy for a workflow
   */
  determineStrategy(context: WorkflowResumeContext): ResumeResult {
    this.logger.debug('Determining resume strategy', {
      currentStep: context.currentStepIndex,
      notCompleted: context.notCompletedSteps,
      pausedAt: context.pausedAt,
    })

    // Priority 1: Check for steps that need fallback
    const fallbackResult = this.checkForFallback(context)
    if (fallbackResult) {
      return fallbackResult
    }

    // Priority 2: Check for chain resume
    const chainResult = this.checkForChainResume(context)
    if (chainResult) {
      return chainResult
    }

    // Priority 3: Check for pause resume
    const pauseResult = this.checkForPauseResume(context)
    if (pauseResult) {
      return pauseResult
    }

    // Priority 4: Check for crash recovery
    const crashResult = this.checkForCrashRecovery(context)
    if (crashResult) {
      return crashResult
    }

    // Default: Fresh start
    return this.createFreshResult(context.currentStepIndex)
  }

  /**
   * Determine strategy for a specific step
   */
  determineStepStrategy(
    stepIndex: number,
    stepData: StepResumeData,
    chainedPrompts?: ChainedPrompt[]
  ): ResumeResult {
    // Check if step was skipped
    if (stepData.skipped) {
      return this.createFreshResult(stepIndex + 1)
    }

    // Check if step was completed
    if (stepData.completedAt) {
      return this.createFreshResult(stepIndex + 1)
    }

    // Check for chain resume
    if (chainedPrompts && chainedPrompts.length > 0) {
      const nextChainIndex = this.findNextChainIndex(
        stepData.completedChains,
        chainedPrompts.length
      )

      if (nextChainIndex !== null && stepData.sessionId) {
        return {
          strategy: {
            type: 'chain-resume',
            chainIndex: nextChainIndex,
            sessionId: stepData.sessionId,
          },
          stepIndex,
          chainIndex: nextChainIndex,
          sessionId: stepData.sessionId,
          requiresFallback: false,
          message: `Resuming step ${stepIndex} from chain ${nextChainIndex}`,
        }
      }
    }

    // Check for pause resume
    if (stepData.sessionId && stepData.startedAt && !stepData.completedAt) {
      return {
        strategy: {
          type: 'pause-resume',
          sessionId: stepData.sessionId,
          pausedAt: stepData.startedAt,
        },
        stepIndex,
        sessionId: stepData.sessionId,
        requiresFallback: false,
        message: `Resuming step ${stepIndex} from pause`,
      }
    }

    // Fresh start for this step
    return this.createFreshResult(stepIndex)
  }

  /**
   * Check if any steps need fallback agent first
   */
  private checkForFallback(context: WorkflowResumeContext): ResumeResult | null {
    if (!context.fallbackAgentId) {
      return null
    }

    // Check if there are not-completed steps that need fallback
    const needsFallback = context.notCompletedSteps.some((stepIdx) => {
      const step = context.steps[stepIdx]
      // Step started but not completed - needs fallback
      return step && step.startedAt && !step.completedAt && !step.skipped
    })

    if (!needsFallback) {
      return null
    }

    const firstNotCompleted = Math.min(...context.notCompletedSteps)

    // Determine the inner strategy after fallback
    const innerStrategy = this.determineWithoutFallback(context)

    return {
      strategy: {
        type: 'fallback-first',
        fallbackAgentId: context.fallbackAgentId,
        then: innerStrategy.strategy,
      },
      stepIndex: firstNotCompleted,
      requiresFallback: true,
      message: `Running fallback agent before resuming step ${firstNotCompleted}`,
    }
  }

  /**
   * Check for chain resume opportunity
   */
  private checkForChainResume(context: WorkflowResumeContext): ResumeResult | null {
    const currentStep = context.steps[context.currentStepIndex]

    if (!currentStep || !currentStep.sessionId) {
      return null
    }

    // Check if there are incomplete chains
    if (currentStep.completedChains.length === 0) {
      return null
    }

    // Find next chain index
    // This assumes we know the total chains - for now, we check if last completed chain
    // is less than some reasonable max (will be refined with actual chain data)
    const lastCompleted = Math.max(...currentStep.completedChains)
    const nextChainIndex = lastCompleted + 1

    return {
      strategy: {
        type: 'chain-resume',
        chainIndex: nextChainIndex,
        sessionId: currentStep.sessionId,
      },
      stepIndex: context.currentStepIndex,
      chainIndex: nextChainIndex,
      sessionId: currentStep.sessionId,
      requiresFallback: false,
      message: `Resuming step ${context.currentStepIndex} from chain ${nextChainIndex}`,
    }
  }

  /**
   * Check for pause resume opportunity
   */
  private checkForPauseResume(context: WorkflowResumeContext): ResumeResult | null {
    if (!context.pausedAt) {
      return null
    }

    const currentStep = context.steps[context.currentStepIndex]

    if (!currentStep || !currentStep.sessionId) {
      // Paused but no session - fresh start
      return null
    }

    return {
      strategy: {
        type: 'pause-resume',
        sessionId: currentStep.sessionId,
        pausedAt: context.pausedAt,
      },
      stepIndex: context.currentStepIndex,
      sessionId: currentStep.sessionId,
      requiresFallback: false,
      message: `Resuming from pause at step ${context.currentStepIndex}`,
    }
  }

  /**
   * Check for crash recovery
   */
  private checkForCrashRecovery(context: WorkflowResumeContext): ResumeResult | null {
    // Check for steps that were started but not completed (crash scenario)
    if (context.notCompletedSteps.length === 0) {
      return null
    }

    const crashedStepIndex = Math.min(...context.notCompletedSteps)
    const crashedStep = context.steps[crashedStepIndex]

    if (!crashedStep || !crashedStep.startedAt) {
      return null
    }

    // If step has a session, try to resume it
    if (crashedStep.sessionId) {
      return {
        strategy: {
          type: 'pause-resume',
          sessionId: crashedStep.sessionId,
          pausedAt: crashedStep.startedAt,
        },
        stepIndex: crashedStepIndex,
        sessionId: crashedStep.sessionId,
        requiresFallback: false,
        message: `Recovering from crash at step ${crashedStepIndex}`,
      }
    }

    // No session - use crash recovery strategy
    return {
      strategy: {
        type: 'crash-recovery',
        lastCheckpoint: crashedStepIndex,
      },
      stepIndex: crashedStepIndex,
      requiresFallback: false,
      message: `Crash recovery from step ${crashedStepIndex}`,
    }
  }

  /**
   * Determine strategy without fallback consideration
   */
  private determineWithoutFallback(context: WorkflowResumeContext): ResumeResult {
    // Try chain resume
    const chainResult = this.checkForChainResume(context)
    if (chainResult) {
      return chainResult
    }

    // Try pause resume
    const pauseResult = this.checkForPauseResume(context)
    if (pauseResult) {
      return pauseResult
    }

    // Try crash recovery
    const crashResult = this.checkForCrashRecovery(context)
    if (crashResult) {
      return crashResult
    }

    // Fresh start
    return this.createFreshResult(context.currentStepIndex)
  }

  /**
   * Create a fresh start result
   */
  private createFreshResult(stepIndex: number): ResumeResult {
    return {
      strategy: { type: 'fresh' },
      stepIndex,
      requiresFallback: false,
      message: `Fresh start at step ${stepIndex}`,
    }
  }

  /**
   * Find the next chain index that hasn't been completed
   */
  private findNextChainIndex(
    completedChains: number[],
    totalChains: number
  ): number | null {
    for (let i = 0; i < totalChains; i++) {
      if (!completedChains.includes(i)) {
        return i
      }
    }
    return null // All chains completed
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let resumeService: ResumeService | null = null

export const getResumeService = (): ResumeService => {
  if (!resumeService) {
    resumeService = new ResumeService()
  }
  return resumeService
}

// ============================================================================
// Strategy Execution Helpers
// ============================================================================

export const isChainResume = (
  strategy: ResumeStrategy
): strategy is Extract<ResumeStrategy, { type: 'chain-resume' }> =>
  strategy.type === 'chain-resume'

export const isPauseResume = (
  strategy: ResumeStrategy
): strategy is Extract<ResumeStrategy, { type: 'pause-resume' }> =>
  strategy.type === 'pause-resume'

export const isCrashRecovery = (
  strategy: ResumeStrategy
): strategy is Extract<ResumeStrategy, { type: 'crash-recovery' }> =>
  strategy.type === 'crash-recovery'

export const isFallbackFirst = (
  strategy: ResumeStrategy
): strategy is Extract<ResumeStrategy, { type: 'fallback-first' }> =>
  strategy.type === 'fallback-first'

export const isFresh = (
  strategy: ResumeStrategy
): strategy is Extract<ResumeStrategy, { type: 'fresh' }> =>
  strategy.type === 'fresh'

export const hasSession = (result: ResumeResult): boolean =>
  result.sessionId !== undefined
