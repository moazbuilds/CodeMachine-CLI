/**
 * Progress Indicator Component
 *
 * Visual progress indicator for onboarding steps.
 */

import { For, type JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { OnboardingStep } from '../types'

/**
 * Progress indicator props
 */
export interface ProgressIndicatorProps {
  /** All steps */
  steps: OnboardingStep[]
  /** Current step index */
  currentIndex: number
}

/**
 * Get step indicator character
 */
function getStepIndicator(
  step: OnboardingStep,
  index: number,
  currentIndex: number
): string {
  if (step.completed) return '✓'
  if (index === currentIndex) return '●'
  return '○'
}

/**
 * Get step color
 */
function getStepColor(
  step: OnboardingStep,
  index: number,
  currentIndex: number
): string {
  if (step.completed) return 'green'
  if (index === currentIndex) return 'cyan'
  return 'gray'
}

/**
 * Progress indicator component
 *
 * @example
 * ```tsx
 * <ProgressIndicator
 *   steps={steps}
 *   currentIndex={currentStep}
 * />
 * ```
 */
export function ProgressIndicator(props: ProgressIndicatorProps): JSX.Element {
  return (
    <Box flexDirection="row" gap={1} justifyContent="center">
      <For each={props.steps}>
        {(step, index) => {
          const indicator = () =>
            getStepIndicator(step, index(), props.currentIndex)
          const color = () => getStepColor(step, index(), props.currentIndex)

          return (
            <>
              <Text color={color()} bold={index() === props.currentIndex}>
                {indicator()}
              </Text>
              {index() < props.steps.length - 1 && (
                <Text color="gray">─</Text>
              )}
            </>
          )
        }}
      </For>
    </Box>
  )
}
