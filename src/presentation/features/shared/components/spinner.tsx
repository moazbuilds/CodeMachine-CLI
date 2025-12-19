/**
 * Spinner Component
 *
 * Animated loading spinner for indicating progress.
 */

import { createSignal, onMount, onCleanup, type JSX } from 'solid-js'
import { Text } from '@anthropic-ai/claude-cli/dist/components/index.js'

// ============================================================================
// Types
// ============================================================================

export interface SpinnerProps {
  /** Spinner type */
  type?: 'dots' | 'line' | 'arc' | 'bounce'
  /** Text color */
  color?: string
  /** Optional label */
  label?: string
}

// ============================================================================
// Spinner Frames
// ============================================================================

const SPINNER_FRAMES = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '-', '\\'],
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
} as const

// ============================================================================
// Component
// ============================================================================

/**
 * Animated spinner component
 *
 * @example
 * ```tsx
 * <Spinner type="dots" label="Loading..." />
 * ```
 */
export function Spinner(props: SpinnerProps): JSX.Element {
  const [frameIndex, setFrameIndex] = createSignal(0)

  const frames = () => SPINNER_FRAMES[props.type ?? 'dots']
  const frame = () => frames()[frameIndex()]
  const color = () => props.color ?? 'cyan'

  onMount(() => {
    const interval = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frames().length)
    }, 80)

    onCleanup(() => clearInterval(interval))
  })

  return (
    <Text color={color()}>
      {frame()}
      {props.label ? ` ${props.label}` : ''}
    </Text>
  )
}
