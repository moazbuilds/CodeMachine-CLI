/**
 * Output Line Component
 *
 * Individual line of output with type-specific styling.
 */

import type { JSX } from 'solid-js'
import { Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { OutputLine } from '../../types'

/**
 * Output line props
 */
export interface OutputLineProps {
  /** The output line */
  line: OutputLine
}

/**
 * Get color based on line type
 */
function getLineColor(type: OutputLine['type']): string {
  switch (type) {
    case 'prompt':
      return 'cyan'
    case 'command':
      return 'yellow'
    case 'error':
      return 'red'
    case 'system':
      return 'gray'
    default:
      return 'white'
  }
}

/**
 * Get prefix based on line type
 */
function getLinePrefix(type: OutputLine['type']): string {
  switch (type) {
    case 'prompt':
      return '> '
    case 'command':
      return '$ '
    case 'error':
      return '! '
    case 'system':
      return '# '
    default:
      return ''
  }
}

/**
 * Output line component
 *
 * @example
 * ```tsx
 * <OutputLineComponent line={line} />
 * ```
 */
export function OutputLineComponent(props: OutputLineProps): JSX.Element {
  const color = () => getLineColor(props.line.type)
  const prefix = () => getLinePrefix(props.line.type)

  return (
    <Text color={color()} wrap="wrap">
      {prefix()}
      {props.line.content}
    </Text>
  )
}
