/** @jsxImportSource @opentui/solid */
/**
 * Typing Text Component
 * Typewriter effect that reveals text character by character
 * After typing completes, shows animated loading dots (. → .. → ...)
 * When text changes, erases and retypes the new text
 */

import { createSignal, onCleanup, createEffect } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface TypingTextProps {
  text: string
  speed?: number // ms per character
  dotSpeed?: number // ms per dot frame
}

type Phase = "typing" | "dots" | "erasing"

/**
 * Typewriter effect component
 * Reveals text character by character, then cycles loading dots
 * Erases and retypes when text changes
 */
export function TypingText(props: TypingTextProps) {
  const themeCtx = useTheme()
  const [visibleChars, setVisibleChars] = createSignal(0)
  const [dotFrame, setDotFrame] = createSignal(0)
  const [phase, setPhase] = createSignal<Phase>("typing")
  // displayedText holds the text currently being animated (stable during transitions)
  const [displayedText, setDisplayedText] = createSignal(props.text)
  // pendingText holds the next text to type after erasing
  const [pendingText, setPendingText] = createSignal<string | null>(null)

  const speed = () => props.speed ?? 30
  const dotSpeed = () => props.dotSpeed ?? 400

  const DOT_FRAMES = [".", "..", "..."]

  // Handle text changes - queue new text and trigger erase
  let lastPropsText = props.text
  createEffect(() => {
    const newText = props.text
    if (newText !== lastPropsText) {
      lastPropsText = newText
      const currentDisplayed = displayedText()
      if (currentDisplayed !== newText) {
        // Queue the new text and start erasing
        setPendingText(newText)
        setPhase("erasing")
      }
    }
  })

  // Main animation loop
  createEffect(() => {
    const currentPhase = phase()
    const text = displayedText()
    let interval: NodeJS.Timeout | undefined

    if (currentPhase === "typing") {
      // Type characters one by one
      interval = setInterval(() => {
        setVisibleChars((prev) => {
          if (prev >= text.length) {
            clearInterval(interval)
            setPhase("dots")
            return prev
          }
          return prev + 1
        })
      }, speed())
    } else if (currentPhase === "dots") {
      // Cycle through dot frames
      interval = setInterval(() => {
        setDotFrame((prev) => (prev + 1) % DOT_FRAMES.length)
      }, dotSpeed())
    } else if (currentPhase === "erasing") {
      // Erase characters quickly
      interval = setInterval(() => {
        setVisibleChars((prev) => {
          if (prev <= 0) {
            clearInterval(interval)
            // Done erasing - switch to pending text and start typing
            const nextText = pendingText()
            if (nextText !== null) {
              setDisplayedText(nextText)
              setPendingText(null)
            }
            setDotFrame(0)
            setPhase("typing")
            return 0
          }
          return prev - 1
        })
      }, speed() / 2)
    }

    onCleanup(() => {
      if (interval) clearInterval(interval)
    })
  })

  const displayText = () => {
    const baseText = displayedText().slice(0, visibleChars())
    if (phase() === "dots") {
      return baseText + DOT_FRAMES[dotFrame()]
    }
    return baseText
  }

  return <text fg={themeCtx.theme.warning}>{displayText()}</text>
}
