/** @jsxImportSource @opentui/solid */
/**
 * Typing Text Component
 * Typewriter effect that reveals text character by character
 * After 3 seconds, reverse typing effect to disappear
 */

import { createSignal, onCleanup, createEffect } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface TypingTextProps {
  text: string
  speed?: number // ms per character
  displayDuration?: number // ms to display before disappearing
}

/**
 * Typewriter effect component
 * Reveals text character by character, then disappears after delay
 */
export function TypingText(props: TypingTextProps) {
  const themeCtx = useTheme()
  const [visibleChars, setVisibleChars] = createSignal(0)
  const speed = () => props.speed ?? 30
  const displayDuration = () => props.displayDuration ?? 1000

  createEffect(() => {
    const text = props.text
    let typeInterval: NodeJS.Timeout | undefined
    let eraseInterval: NodeJS.Timeout | undefined
    let displayTimeout: NodeJS.Timeout | undefined

    // Reset and start typing when text changes
    setVisibleChars(0)

    // Type in
    typeInterval = setInterval(() => {
      setVisibleChars((prev) => {
        if (prev >= text.length) {
          clearInterval(typeInterval)
          // Wait then start erasing
          displayTimeout = setTimeout(() => {
            eraseInterval = setInterval(() => {
              setVisibleChars((prev) => {
                if (prev <= 0) {
                  clearInterval(eraseInterval)
                  return 0
                }
                return prev - 1
              })
            }, speed() / 2) // Erase faster
          }, displayDuration())
          return prev
        }
        return prev + 1
      })
    }, speed())

    onCleanup(() => {
      if (typeInterval) clearInterval(typeInterval)
      if (eraseInterval) clearInterval(eraseInterval)
      if (displayTimeout) clearTimeout(displayTimeout)
    })
  })

  const displayText = () => props.text.slice(0, visibleChars())

  return <text fg={themeCtx.theme.warning}>{displayText()}</text>
}
