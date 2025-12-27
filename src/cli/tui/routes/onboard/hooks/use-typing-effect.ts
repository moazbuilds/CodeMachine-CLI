/**
 * Typing Effect Hook
 *
 * Provides typewriter animation for questions.
 */

import { createSignal, createEffect, type Accessor } from "solid-js"

export interface UseTypingEffectOptions {
  /** Text to type out */
  text: Accessor<string>
  /** Typing speed in ms per character */
  speed?: number
  /** Dependencies that trigger re-typing */
  deps?: Accessor<unknown>[]
}

export interface UseTypingEffectResult {
  /** Currently typed portion of text */
  typedText: Accessor<string>
  /** Whether typing animation is complete */
  typingDone: Accessor<boolean>
}

export function useTypingEffect(options: UseTypingEffectOptions): UseTypingEffectResult {
  const speed = options.speed ?? 50
  const [typedText, setTypedText] = createSignal("")
  const [typingDone, setTypingDone] = createSignal(false)

  createEffect(() => {
    const text = options.text()
    // Track additional dependencies if provided
    options.deps?.forEach(dep => dep())

    setTypedText("")
    setTypingDone(false)

    let i = 0
    const interval = setInterval(() => {
      if (i <= text.length) {
        setTypedText(text.slice(0, i))
        i++
      } else {
        setTypingDone(true)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  })

  return { typedText, typingDone }
}
