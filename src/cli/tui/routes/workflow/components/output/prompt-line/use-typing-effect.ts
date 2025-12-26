/**
 * Typing Effect Hook
 *
 * Creates an animated typing effect for placeholder text.
 * Types forward, pauses, then erases backward in a loop.
 */

import { createSignal, createEffect, onCleanup, Accessor } from "solid-js"

export interface UseTypingEffectOptions {
  /** Text to animate */
  text: string
  /** Whether animation should be active */
  isActive: Accessor<boolean>
  /** Typing speed in milliseconds */
  typingSpeed?: number
  /** Pause duration in cycles (cycles = pauseDuration / typingSpeed) */
  pauseCycles?: number
}

export function useTypingEffect(options: UseTypingEffectOptions) {
  const {
    text,
    isActive,
    typingSpeed = 40,
    pauseCycles = 25, // ~1000ms pause at default speed
  } = options

  const [typingText, setTypingText] = createSignal("")

  createEffect(() => {
    if (!isActive()) {
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
        if (charIndex < text.length) {
          charIndex++
          setTypingText(text.slice(0, charIndex))
        } else {
          pauseCounter++
          if (pauseCounter >= pauseCycles) {
            forward = false
            pauseCounter = 0
          }
        }
      } else {
        if (charIndex > 0) {
          charIndex--
          setTypingText(text.slice(0, charIndex))
        } else {
          pauseCounter++
          if (pauseCounter >= pauseCycles) {
            forward = true
            pauseCounter = 0
          }
        }
      }
    }, typingSpeed)

    onCleanup(() => {
      clearInterval(interval)
    })
  })

  return typingText
}
