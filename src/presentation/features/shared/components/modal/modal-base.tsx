/**
 * Modal Base Component
 *
 * The base container for all modals. Handles visibility, positioning, and backdrop.
 */

import { Show, type JSX } from 'solid-js'
import { Box } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { ModalBaseProps } from './types'

/**
 * Base modal component that provides the container and backdrop
 *
 * @example
 * ```tsx
 * <ModalBase isOpen={isOpen()} onClose={handleClose} title="My Modal">
 *   <ModalContent>
 *     <Text>Modal content here</Text>
 *   </ModalContent>
 *   <ModalFooter>
 *     <Button onClick={handleClose}>Close</Button>
 *   </ModalFooter>
 * </ModalBase>
 * ```
 */
export function ModalBase(props: ModalBaseProps): JSX.Element {
  const width = () => props.width ?? 60
  const height = () => props.height ?? 20
  const bordered = () => props.bordered ?? true

  return (
    <Show when={props.isOpen}>
      <Box
        flexDirection="column"
        width={width()}
        height={height()}
        borderStyle={bordered() ? 'round' : undefined}
        borderColor="cyan"
      >
        {props.children}
      </Box>
    </Show>
  )
}
