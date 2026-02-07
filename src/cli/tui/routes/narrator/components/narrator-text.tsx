/** @jsxImportSource @opentui/solid */
/**
 * Narrator Text Component
 *
 * Typewriter effect that reveals text character by character,
 * handling inline delays {N} and face changes [face].
 */

import { createSignal, onCleanup, onMount } from 'solid-js'
import { useTheme } from '@tui/shared/context/theme'
import type { TextSegment } from '../parser/types.js'

export interface NarratorTextProps {
  /** Text segments to display (text, delays, face changes) */
  segments: TextSegment[]
  /** Milliseconds per character (default: 30) */
  speed?: number
  /** Callback when face should change */
  onFaceChange?: (expression: string) => void
  /** Callback when typing completes */
  onComplete?: () => void
  /** Signal to reset/restart the animation */
  restartKey?: number
}

/**
 * Narrator text component with typing animation
 */
export function NarratorText(props: NarratorTextProps) {
  const themeCtx = useTheme()

  const [displayedText, setDisplayedText] = createSignal('')
  const [isTyping, setIsTyping] = createSignal(true)

  const speed = () => props.speed ?? 30

  let currentTimeout: NodeJS.Timeout | undefined
  let currentInterval: NodeJS.Timeout | undefined

  const cleanup = () => {
    if (currentTimeout) clearTimeout(currentTimeout)
    if (currentInterval) clearInterval(currentInterval)
  }

  const runAnimation = async () => {
    cleanup()
    setDisplayedText('')
    setIsTyping(true)

    const segments = props.segments

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const segment = segments[segIdx]

      if (segment.type === 'text') {
        // Type text character by character
        const content = segment.content
        for (let i = 0; i < content.length; i++) {
          await new Promise<void>((resolve) => {
            currentTimeout = setTimeout(() => {
              setDisplayedText((text) => text + content[i])
              resolve()
            }, speed())
          })
        }
      } else if (segment.type === 'delay') {
        // Pause for specified seconds
        await new Promise<void>((resolve) => {
          currentTimeout = setTimeout(resolve, segment.seconds * 1000)
        })
      } else if (segment.type === 'face') {
        // Emit face change and continue immediately
        props.onFaceChange?.(segment.expression)
      }
    }

    // Animation complete
    setIsTyping(false)
    props.onComplete?.()
  }

  // Start animation on mount and when restartKey changes
  onMount(() => {
    runAnimation()
  })

  // Watch for restartKey changes
  let lastRestartKey = props.restartKey
  const checkRestart = () => {
    if (props.restartKey !== lastRestartKey) {
      lastRestartKey = props.restartKey
      runAnimation()
    }
  }

  // Poll for restartKey changes (simple approach)
  const restartInterval = setInterval(checkRestart, 50)

  onCleanup(() => {
    cleanup()
    clearInterval(restartInterval)
  })

  // Show cursor while typing
  const cursorChar = () => (isTyping() ? '_' : '')

  return (
    <text fg={themeCtx.theme.warning}>
      {displayedText()}
      {cursorChar()}
    </text>
  )
}
