/**
 * Step Navigation Component
 *
 * Navigation buttons for onboarding steps.
 */

import { Show, type JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'

/**
 * Step navigation props
 */
export interface StepNavigationProps {
  /** Can go back */
  canGoBack: boolean
  /** Can go forward */
  canGoForward: boolean
  /** Can skip */
  canSkip: boolean
  /** Is last step */
  isLast: boolean
  /** Called when back is pressed */
  onBack: () => void
  /** Called when next/finish is pressed */
  onNext: () => void
  /** Called when skip is pressed */
  onSkip: () => void
}

/**
 * Step navigation component
 *
 * @example
 * ```tsx
 * <StepNavigation
 *   canGoBack={currentStep > 0}
 *   canGoForward={isStepValid}
 *   canSkip={!step.required}
 *   isLast={currentStep === steps.length - 1}
 *   onBack={previousStep}
 *   onNext={nextStep}
 *   onSkip={skipStep}
 * />
 * ```
 */
export function StepNavigation(props: StepNavigationProps): JSX.Element {
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      paddingY={1}
      borderTop
      borderColor="gray"
    >
      {/* Left side - Back button */}
      <Box>
        <Show when={props.canGoBack}>
          <Text color="gray">
            ← Back
          </Text>
        </Show>
      </Box>

      {/* Right side - Skip and Next/Finish */}
      <Box flexDirection="row" gap={2}>
        <Show when={props.canSkip}>
          <Text color="gray" dimColor>
            [S] Skip
          </Text>
        </Show>
        <Text color={props.canGoForward ? 'cyan' : 'gray'} bold>
          [Enter] {props.isLast ? 'Finish' : 'Next →'}
        </Text>
      </Box>
    </Box>
  )
}
