/**
 * Step Container Component
 *
 * Container for onboarding step content.
 */

import type { JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { OnboardingStep } from '../types'

/**
 * Step container props
 */
export interface StepContainerProps {
  /** Current step */
  step: OnboardingStep
  /** Children content */
  children?: JSX.Element
}

/**
 * Step container component
 *
 * @example
 * ```tsx
 * <StepContainer step={currentStep}>
 *   <ProjectNameStep ... />
 * </StepContainer>
 * ```
 */
export function StepContainer(props: StepContainerProps): JSX.Element {
  return (
    <Box flexDirection="column" gap={1} padding={1}>
      {/* Step header */}
      <Box flexDirection="column" gap={0}>
        <Text color="cyan" bold>
          {props.step.title}
        </Text>
        {props.step.description && (
          <Text color="gray" dimColor>
            {props.step.description}
          </Text>
        )}
      </Box>

      {/* Step content */}
      <Box flexDirection="column" paddingTop={1}>
        {props.children}
      </Box>
    </Box>
  )
}
