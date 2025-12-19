/**
 * Modal Header Component
 *
 * Header section for modals with title and optional close button.
 */

import { Show, type JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { ModalHeaderProps } from './types'

/**
 * Modal header with title and optional close button
 *
 * @example
 * ```tsx
 * <ModalHeader
 *   title="Confirm Action"
 *   subtitle="Please review before continuing"
 *   onClose={handleClose}
 * />
 * ```
 */
export function ModalHeader(props: ModalHeaderProps): JSX.Element {
  const showClose = () => props.showCloseButton ?? true

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      borderBottom
      borderColor="gray"
    >
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text bold color="cyan">
          {props.title}
        </Text>
        <Show when={showClose() && props.onClose}>
          <Text color="gray">[Esc]</Text>
        </Show>
      </Box>
      <Show when={props.subtitle}>
        <Text color="gray" dimColor>
          {props.subtitle}
        </Text>
      </Show>
      {props.children}
    </Box>
  )
}
