/**
 * Input Prompt Component
 *
 * Input field for user commands and responses.
 */

import type { JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { WorkflowMode } from '../../types'

/**
 * Input prompt props
 */
export interface InputPromptProps {
  /** Current value */
  value: string
  /** Called when value changes */
  onChange: (value: string) => void
  /** Called when input is submitted */
  onSubmit: () => void
  /** Current mode */
  mode: WorkflowMode
  /** Placeholder text */
  placeholder?: string
}

/**
 * Input prompt component
 *
 * @example
 * ```tsx
 * <InputPrompt
 *   value={inputValue()}
 *   onChange={setInputValue}
 *   onSubmit={handleSubmit}
 *   mode="manual"
 * />
 * ```
 */
export function InputPrompt(props: InputPromptProps): JSX.Element {
  const placeholder = () =>
    props.placeholder ??
    (props.mode === 'autopilot'
      ? 'Autopilot active - press Shift+Tab to switch to manual'
      : 'Type your response...')

  const promptChar = () => (props.mode === 'autopilot' ? '⚡' : '>')

  return (
    <Box
      flexDirection="row"
      paddingX={1}
      paddingY={1}
      borderTop
      borderColor="cyan"
      gap={1}
    >
      <Text color="cyan" bold>
        {promptChar()}
      </Text>
      <Text color={props.value ? 'white' : 'gray'} dimColor={!props.value}>
        {props.value || placeholder()}
      </Text>
      <Text color="cyan">▌</Text>
    </Box>
  )
}
