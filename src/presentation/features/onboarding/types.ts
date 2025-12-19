/**
 * Onboarding Feature Types
 */

/**
 * Onboarding step definition
 */
export interface OnboardingStep {
  /** Step ID */
  id: string
  /** Step title */
  title: string
  /** Step description */
  description?: string
  /** Whether the step is required */
  required: boolean
  /** Whether the step is complete */
  completed: boolean
  /** Step data */
  data?: unknown
}

/**
 * Onboarding state
 */
export interface OnboardingState {
  /** Current step index */
  currentStep: number
  /** All steps */
  steps: OnboardingStep[]
  /** Whether onboarding is complete */
  isComplete: boolean
  /** Collected data */
  collectedData: OnboardingData
}

/**
 * Collected onboarding data
 */
export interface OnboardingData {
  /** Project name */
  projectName?: string
  /** Selected tracks */
  tracks?: string[]
  /** Conditions/preferences */
  conditions?: Record<string, boolean>
  /** Autopilot preference */
  autopilotEnabled?: boolean
}

/**
 * Onboarding actions
 */
export interface OnboardingActions {
  /** Go to next step */
  nextStep: () => void
  /** Go to previous step */
  previousStep: () => void
  /** Go to specific step */
  goToStep: (index: number) => void
  /** Complete current step */
  completeStep: (data?: unknown) => void
  /** Skip current step */
  skipStep: () => void
  /** Finish onboarding */
  finish: () => void
  /** Reset onboarding */
  reset: () => void
}

/**
 * Step component props
 */
export interface StepProps<T = unknown> {
  /** Step data */
  data?: T
  /** Called when step data changes */
  onChange: (data: T) => void
  /** Called when step is complete */
  onComplete: () => void
  /** Called to go back */
  onBack?: () => void
  /** Whether this is the last step */
  isLast: boolean
}
