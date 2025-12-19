/**
 * Modal Footer Component
 *
 * Footer section for modals, typically containing action buttons.
 */

import type { JSX } from 'solid-js'
import { Box } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { ModalFooterProps } from './types'

/**
 * Modal footer for action buttons
 *
 * @example
 * ```tsx
 * <ModalFooter align="right">
 *   <Button onClick={handleCancel}>Cancel</Button>
 *   <Button onClick={handleConfirm} color="green">Confirm</Button>
 * </ModalFooter>
 * ```
 */
export function ModalFooter(props: ModalFooterProps): JSX.Element {
  const alignMap = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
    'space-between': 'space-between',
  } as const

  const justify = () => alignMap[props.align ?? 'right']

  return (
    <Box
      flexDirection="row"
      justifyContent={justify()}
      gap={1}
      paddingX={1}
      paddingY={1}
      borderTop
      borderColor="gray"
    >
      {props.children}
    </Box>
  )
}
