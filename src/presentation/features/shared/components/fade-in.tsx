/**
 * Fade In Component
 *
 * Animated fade-in effect for content.
 */

import { createSignal, onMount, Show, type JSX } from 'solid-js'
import { Box } from '@anthropic-ai/claude-cli/dist/components/index.js'

// ============================================================================
// Types
// ============================================================================

export interface FadeInProps {
  /** Delay before showing content (ms) */
  delay?: number
  /** Children to fade in */
  children?: JSX.Element
}

// ============================================================================
// Component
// ============================================================================

/**
 * Fade in container that reveals content after a delay
 *
 * @example
 * ```tsx
 * <FadeIn delay={200}>
 *   <Text>This appears after 200ms</Text>
 * </FadeIn>
 * ```
 */
export function FadeIn(props: FadeInProps): JSX.Element {
  const [visible, setVisible] = createSignal(false)

  onMount(() => {
    const delay = props.delay ?? 0

    if (delay === 0) {
      setVisible(true)
    } else {
      const timeout = setTimeout(() => setVisible(true), delay)
      return () => clearTimeout(timeout)
    }
  })

  return (
    <Show when={visible()}>
      <Box>{props.children}</Box>
    </Show>
  )
}
