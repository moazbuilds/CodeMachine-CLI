/** @jsxImportSource @opentui/solid */
/**
 * Prompt Line Component
 *
 * Always-present command input at the bottom of the output window.
 * Replaces modal-based pause and chained prompt box with inline UX.
 *
 * States:
 * - disabled: Workflow not running / completed (grayed out)
 * - passive: Agent working, user can see but not type
 * - active: Waiting for user input (paused or chaining)
 * - chained: Shows next prompt in chain
 */

import { createSignal, createEffect, onCleanup, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"

export type PromptLineState =
  | { mode: "disabled" }
  | { mode: "passive" }
  | { mode: "active"; reason?: "paused" | "chaining" }
  | { mode: "chained"; label: string; index: number; total: number }

export interface PromptLineProps {
  state: PromptLineState
  isFocused: boolean
  onSubmit: (prompt: string) => void
  onNextStep?: () => void
  onFocusExit: () => void
}

export function PromptLine(props: PromptLineProps) {
  const themeCtx = useTheme()
  const [input, setInput] = createSignal("")
  const [typingText, setTypingText] = createSignal("")
  const [isTypingForward, setIsTypingForward] = createSignal(true)

  const TYPING_SPEED = 40 // ms per character
  const PAUSE_DURATION = 1000 // ms to pause at full text before erasing

  const TYPING_MESSAGE = "Enter to continue or type prompt..."

  // Typing effect for placeholder when focused and input is empty
  let typingInterval: ReturnType<typeof setInterval> | null = null

  createEffect(() => {
    const shouldAnimate = props.isFocused &&
      (props.state.mode === "active" || props.state.mode === "chained") &&
      input() === ""

    if (shouldAnimate) {
      let charIndex = 0
      let forward = true
      let pauseCounter = 0

      // Start fresh
      setTypingText("")

      typingInterval = setInterval(() => {
        if (forward) {
          if (charIndex < TYPING_MESSAGE.length) {
            charIndex++
            setTypingText(TYPING_MESSAGE.slice(0, charIndex))
          } else {
            // Pause at full text
            pauseCounter++
            if (pauseCounter >= PAUSE_DURATION / TYPING_SPEED) {
              forward = false
              pauseCounter = 0
            }
          }
        } else {
          if (charIndex > 0) {
            charIndex--
            setTypingText(TYPING_MESSAGE.slice(0, charIndex))
          } else {
            // Pause at empty
            pauseCounter++
            if (pauseCounter >= PAUSE_DURATION / TYPING_SPEED) {
              forward = true
              pauseCounter = 0
            }
          }
        }
      }, TYPING_SPEED)
    } else {
      if (typingInterval) {
        clearInterval(typingInterval)
        typingInterval = null
      }
      setTypingText("")
    }
  })

  onCleanup(() => {
    if (typingInterval) clearInterval(typingInterval)
  })

  // Global keyboard handling for escape/navigation (only when focused)
  useKeyboard((evt) => {
    if (!props.isFocused) return

    // Escape - exit focus
    if (evt.name === "escape") {
      evt.preventDefault()
      props.onFocusExit()
      return
    }

    // Left arrow at start of input - exit focus
    if (evt.name === "left" && input() === "") {
      evt.preventDefault()
      props.onFocusExit()
      return
    }
    // Don't preventDefault for other keys - let them pass to input
  })

  const handleSubmit = () => {
    const value = input().trim()
    if (value) {
      props.onSubmit(value)
      setInput("")
    } else if (props.state.mode === "chained" && props.onNextStep) {
      // Empty submit on chained = run next step
      props.onNextStep()
    } else if (props.state.mode === "active") {
      // Empty submit on active (paused) = resume
      props.onSubmit("")
    }
  }

  const handleKeyDown = (evt: { name?: string }) => {
    if (evt.name === "return") {
      handleSubmit()
    }
  }

  const isInteractive = () =>
    props.state.mode === "active" || props.state.mode === "chained"

  const getPromptSymbol = () => {
    if (props.state.mode === "disabled") return "·"
    if (props.state.mode === "active" && props.state.reason === "paused") return "⏸"
    return "❯"
  }

  const getSymbolColor = () => {
    if (props.state.mode === "disabled") return themeCtx.theme.textMuted
    if (props.state.mode === "active" && props.state.reason === "paused")
      return themeCtx.theme.warning
    return themeCtx.theme.primary
  }

  const getPlaceholder = () => {
    if (props.state.mode === "disabled") return "Workflow idle"
    if (props.state.mode === "passive") return "Agent working..."
    if (props.state.mode === "active") {
      if (props.state.reason === "paused") return "Type to steer or Enter to resume"
      return "Type to steer agent..."
    }
    if (props.state.mode === "chained") {
      return `Next: "${props.state.label}" (${props.state.index}/${props.state.total})`
    }
    return ""
  }

  const getHint = () => {
    if (!isInteractive()) return null
    if (props.state.mode === "chained") {
      return `Step ${props.state.index}/${props.state.total}: ${props.state.label}`
    }
    if (props.state.mode === "active" && props.state.reason === "paused") {
      return "[Enter] Resume"
    }
    return "[Enter] Send"
  }

  const showInput = () => props.isFocused && isInteractive()

  return (
    <box flexDirection="column" flexShrink={0} paddingLeft={1} paddingRight={1}>
      {/* Separator line */}
      <box height={1}>
        <text fg={themeCtx.theme.borderSubtle}>
          {"─".repeat(60)}
        </text>
      </box>

      {/* Prompt line */}
      <box flexDirection="row" height={1} justifyContent="space-between">
        <box flexDirection="row" flexGrow={1}>
          {/* Prompt symbol */}
          <text fg={getSymbolColor()}>{getPromptSymbol()} </text>

          {/* Placeholder text (when not focused) */}
          <Show when={!showInput()}>
            <text fg={themeCtx.theme.textMuted}>{getPlaceholder()}</text>
          </Show>

          {/* Input (shown when focused and interactive) */}
          <Show when={showInput()}>
            <input
              value={input()}
              placeholder={typingText()}
              placeholderColor={themeCtx.theme.textMuted}
              onInput={setInput}
              onKeyDown={handleKeyDown}
              focused={true}
              flexGrow={1}
              backgroundColor={themeCtx.theme.background}
              focusedBackgroundColor={themeCtx.theme.background}
              textColor={themeCtx.theme.text}
              focusedTextColor={themeCtx.theme.text}
              cursorColor={themeCtx.theme.primary}
            />
          </Show>
        </box>

        {/* Hint */}
        <Show when={getHint()}>
          <text fg={themeCtx.theme.textMuted}> {getHint()}</text>
        </Show>
      </box>

      {/* Context hint when not focused but interactive */}
      <Show when={!props.isFocused && isInteractive()}>
        <box height={1} paddingLeft={2}>
          <text fg={themeCtx.theme.textMuted}>
            Press [→] to focus input
          </text>
        </box>
      </Show>
    </box>
  )
}
