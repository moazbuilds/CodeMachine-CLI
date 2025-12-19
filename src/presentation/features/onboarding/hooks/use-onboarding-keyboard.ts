/**
 * Use Onboarding Keyboard Hook
 *
 * Manages keyboard shortcuts for the onboarding flow.
 */

import { useActionKeys, useNavigationKeys } from '../../../hooks/keyboard'
import { useKeyBindings } from '../../../hooks/keyboard'
import type { OnboardingActions, OnboardingStep } from '../types'

/**
 * Options for onboarding keyboard hook
 */
export interface UseOnboardingKeyboardOptions {
  /** Onboarding actions */
  actions: OnboardingActions
  /** Current step */
  currentStep: OnboardingStep
  /** Whether input is focused */
  isInputFocused: boolean
  /** Can go back */
  canGoBack: boolean
  /** Can skip */
  canSkip: boolean
}

/**
 * Set up keyboard handlers for onboarding flow
 *
 * @example
 * ```typescript
 * useOnboardingKeyboard({
 *   actions,
 *   currentStep,
 *   isInputFocused: false,
 *   canGoBack: state.currentStep > 0,
 *   canSkip: !currentStep.required,
 * })
 * ```
 */
export function useOnboardingKeyboard(
  options: UseOnboardingKeyboardOptions
): (() => void)[] {
  const unsubscribes: (() => void)[] = []
  const { addBinding } = useKeyBindings()

  // Action keys
  unsubscribes.push(
    ...useActionKeys({
      handlers: {
        onEnter: () => {
          if (!options.isInputFocused) {
            options.actions.completeStep()
          }
        },
        onEscape: () => {
          if (options.canGoBack) {
            options.actions.previousStep()
          }
        },
        onBackspace: () => {
          if (!options.isInputFocused && options.canGoBack) {
            options.actions.previousStep()
          }
        },
      },
      enabled: () => true,
    })
  )

  // Skip shortcut (S key)
  if (options.canSkip) {
    unsubscribes.push(
      addBinding({
        key: 's',
        handler: (evt) => {
          if (!options.isInputFocused) {
            evt.preventDefault()
            options.actions.skipStep()
          }
        },
        description: 'Skip step',
        enabled: () => !options.isInputFocused,
        priority: 20,
      })
    )
  }

  // Navigation keys for multi-select steps
  unsubscribes.push(
    ...useNavigationKeys({
      actions: {
        navigateUp: () => {
          // Navigation handled by individual step components
        },
        navigateDown: () => {
          // Navigation handled by individual step components
        },
      },
      enabled: () => !options.isInputFocused,
    })
  )

  return unsubscribes
}
