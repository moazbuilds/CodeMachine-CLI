/**
 * Typing Animation Hook
 *
 * Creates a typewriter-style animation effect for placeholder text.
 * Animates forward, pauses, then animates backward in a loop.
 */

import { createSignal, createEffect, onCleanup, Accessor } from "solid-js"

export interface UseTypingAnimationOptions {
  /** Text to animate */
  text: string
  /** Whether animation should run */
  enabled: Accessor<boolean>
  /** Typing speed in ms per character */
  typingSpeed?: number
  /** Pause duration in cycles before reversing */
  pauseCycles?: number
}

export function useTypingAnimation(options: UseTypingAnimationOptions) {
  const [typingText, setTypingText] = createSignal("")

  const TYPING_SPEED = options.typingSpeed ?? 40
  const PAUSE_CYCLES = options.pauseCycles ?? 25 // cycles to pause (1000ms / 40ms)

  createEffect(() => {
    if (!options.enabled()) {
      setTypingText("")
      return
    }

    // Animation state
    let charIndex = 0
    let forward = true
    let pauseCounter = 0

    setTypingText("")

    const interval = setInterval(() => {
      if (forward) {
        if (charIndex < options.text.length) {
          charIndex++
          setTypingText(options.text.slice(0, charIndex))
        } else {
          pauseCounter++
          if (pauseCounter >= PAUSE_CYCLES) {
            forward = false
            pauseCounter = 0
          }
        }
      } else {
        if (charIndex > 0) {
          charIndex--
          setTypingText(options.text.slice(0, charIndex))
        } else {
          pauseCounter++
          if (pauseCounter >= PAUSE_CYCLES) {
            forward = true
            pauseCounter = 0
          }
        }
      }
    }, TYPING_SPEED)

    // Cleanup when effect re-runs or component unmounts
    onCleanup(() => {
      clearInterval(interval)
    })
  })

  return typingText
}
