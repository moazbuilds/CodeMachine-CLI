/**
 * Use Onboarding State Hook
 *
 * Manages state for the onboarding flow.
 */

import { createSignal, createMemo } from 'solid-js'
import type {
  OnboardingState,
  OnboardingActions,
  OnboardingStep,
  OnboardingData,
} from '../types'

/**
 * Default onboarding steps
 */
export const DEFAULT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'project-name',
    title: 'Project Name',
    description: 'Give your project a name',
    required: true,
    completed: false,
  },
  {
    id: 'tracks',
    title: 'Select Tracks',
    description: 'Choose the workflow tracks for your project',
    required: true,
    completed: false,
  },
  {
    id: 'conditions',
    title: 'Conditions',
    description: 'Set your project conditions and preferences',
    required: false,
    completed: false,
  },
  {
    id: 'autopilot',
    title: 'Autopilot',
    description: 'Configure autopilot behavior',
    required: false,
    completed: false,
  },
]

/**
 * Options for onboarding state hook
 */
export interface UseOnboardingStateOptions {
  /** Initial steps (defaults to DEFAULT_ONBOARDING_STEPS) */
  steps?: OnboardingStep[]
  /** Called when onboarding completes */
  onComplete?: (data: OnboardingData) => void
  /** Called when onboarding is cancelled */
  onCancel?: () => void
}

/**
 * Onboarding state and actions
 */
export interface UseOnboardingStateResult {
  /** Current state */
  state: OnboardingState
  /** Actions to modify state */
  actions: OnboardingActions
  /** Current step */
  currentStep: OnboardingStep
  /** Can go back */
  canGoBack: boolean
  /** Can go forward */
  canGoForward: boolean
}

/**
 * Create onboarding state
 *
 * @example
 * ```typescript
 * const { state, actions, currentStep } = useOnboardingState({
 *   onComplete: (data) => saveProject(data),
 * })
 * ```
 */
export function useOnboardingState(
  options: UseOnboardingStateOptions = {}
): UseOnboardingStateResult {
  const initialSteps = options.steps ?? DEFAULT_ONBOARDING_STEPS

  const [currentStepIndex, setCurrentStepIndex] = createSignal(0)
  const [steps, setSteps] = createSignal<OnboardingStep[]>(initialSteps)
  const [collectedData, setCollectedData] = createSignal<OnboardingData>({})

  // Computed values
  const currentStep = createMemo(() => steps()[currentStepIndex()])
  const isComplete = createMemo(() => steps().every((s) => s.completed || !s.required))
  const canGoBack = createMemo(() => currentStepIndex() > 0)
  const canGoForward = createMemo(() => currentStepIndex() < steps().length - 1)

  const state: OnboardingState = {
    get currentStep() {
      return currentStepIndex()
    },
    get steps() {
      return steps()
    },
    get isComplete() {
      return isComplete()
    },
    get collectedData() {
      return collectedData()
    },
  }

  const actions: OnboardingActions = {
    nextStep: () => {
      if (currentStepIndex() < steps().length - 1) {
        setCurrentStepIndex((i) => i + 1)
      }
    },

    previousStep: () => {
      if (currentStepIndex() > 0) {
        setCurrentStepIndex((i) => i - 1)
      }
    },

    goToStep: (index: number) => {
      if (index >= 0 && index < steps().length) {
        setCurrentStepIndex(index)
      }
    },

    completeStep: (data?: unknown) => {
      const stepId = currentStep().id

      // Mark step as completed
      setSteps((prev) =>
        prev.map((s) =>
          s.id === stepId ? { ...s, completed: true, data } : s
        )
      )

      // Update collected data based on step
      if (data !== undefined) {
        setCollectedData((prev) => {
          switch (stepId) {
            case 'project-name':
              return { ...prev, projectName: data as string }
            case 'tracks':
              return { ...prev, tracks: data as string[] }
            case 'conditions':
              return { ...prev, conditions: data as Record<string, boolean> }
            case 'autopilot':
              return { ...prev, autopilotEnabled: data as boolean }
            default:
              return prev
          }
        })
      }

      // Move to next step or finish
      if (currentStepIndex() < steps().length - 1) {
        actions.nextStep()
      }
    },

    skipStep: () => {
      const step = currentStep()
      if (!step.required) {
        actions.nextStep()
      }
    },

    finish: () => {
      if (isComplete()) {
        options.onComplete?.(collectedData())
      }
    },

    reset: () => {
      setCurrentStepIndex(0)
      setSteps(initialSteps.map((s) => ({ ...s, completed: false, data: undefined })))
      setCollectedData({})
    },
  }

  return {
    state,
    actions,
    get currentStep() {
      return currentStep()
    },
    get canGoBack() {
      return canGoBack()
    },
    get canGoForward() {
      return canGoForward()
    },
  }
}
