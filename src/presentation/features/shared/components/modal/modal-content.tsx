/**
 * Modal Content Component
 *
 * Main content area for modals.
 */

import type { JSX } from 'solid-js'
import { Box } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { ModalContentProps } from './types'

/**
 * Modal content container
 *
 * @example
 * ```tsx
 * <ModalContent padded scrollable maxHeight={10}>
 *   <Text>This is scrollable content...</Text>
 * </ModalContent>
 * ```
 */
export function ModalContent(props: ModalContentProps): JSX.Element {
  const padded = () => props.padded ?? true

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      paddingX={padded() ? 1 : 0}
      paddingY={padded() ? 1 : 0}
      overflowY={props.scrollable ? 'hidden' : undefined}
      height={props.maxHeight}
    >
      {props.children}
    </Box>
  )
}
