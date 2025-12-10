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
  onSkip?: () => void
  onFocusExit: () => void
}

export function PromptLine(props: PromptLineProps) {
  const themeCtx = useTheme()
  const [input, setInput] = createSignal("")
  const [typingText, setTypingText] = createSignal("")

  const PLACEHOLDER = "Enter to continue or type prompt..."

  // Typing effect with proper cleanup using onCleanup inside createEffect
  createEffect(() => {
    const shouldAnimate = props.isFocused &&
      (props.state.mode === "active" || props.state.mode === "chained") &&
      input() === ""

    if (!shouldAnimate) {
      setTypingText("")
      return
    }

    // Animation state
    let charIndex = 0
    let forward = true
    let pauseCounter = 0
    const TYPING_SPEED = 40
    const PAUSE_CYCLES = 25 // cycles to pause (1000ms / 40ms)

    setTypingText("")

    const interval = setInterval(() => {
      if (forward) {
        if (charIndex < PLACEHOLDER.length) {
          charIndex++
          setTypingText(PLACEHOLDER.slice(0, charIndex))
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
          setTypingText(PLACEHOLDER.slice(0, charIndex))
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

  // Keyboard is handled by input's onKeyDown - no useKeyboard here to avoid race conditions

  const handleSubmit = () => {
    const value = input().trim()
    if (value) {
      // Custom prompt provided
      props.onSubmit(value)
      setInput("")
    } else {
      // Empty submit - parent decides what to do:
      // - For chained: use next queued prompt
      // - For paused: resume/continue to next agent
      props.onSubmit("")
    }
  }

  const handleKeyDown = (evt: { name?: string; ctrl?: boolean; preventDefault?: () => void }) => {
    // Enter - submit
    if (evt.name === "return") {
      handleSubmit()
      return
    }

    // Left arrow at start - exit focus
    if (evt.name === "left" && input() === "") {
      evt.preventDefault?.()
      props.onFocusExit()
      return
    }

    // Note: Escape and Ctrl+S are handled at workflow-keyboard level
    // to avoid race conditions with multiple useKeyboard hooks
  }

  // Handle paste events (Ctrl+V, right-click paste, terminal paste)
  const handlePaste = (evt: { text: string; preventDefault?: () => void }) => {
    if (!isInteractive() || !evt.text) return

    // Normalize line endings (Windows ConPTY sends CR-only in bracketed paste)
    const normalized = evt.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    // Replace newlines with spaces for single-line input
    const cleanText = normalized.replace(/\n+/g, " ").trim()

    if (cleanText) {
      evt.preventDefault?.()
      setInput((prev) => prev + cleanText)
    }
  }

  const isInteractive = () =>
    props.state.mode === "active" || props.state.mode === "chained"

  const getPromptSymbol = () => {
    if (props.state.mode === "disabled") return "·"
    if (props.state.mode === "active" && props.state.reason === "paused") return "||"
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

  // Always show input when focused (for stability), but only allow typing when interactive
  const showInput = () => props.isFocused

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

          {/* Input (always shown when focused to maintain stable focus) */}
          <Show when={showInput()}>
            <input
              value={input()}
              placeholder={isInteractive() ? typingText() : getPlaceholder()}
              placeholderColor={themeCtx.theme.textMuted}
              onInput={isInteractive() ? setInput : () => {}}
              onKeyDown={isInteractive() ? handleKeyDown : () => {}}
              onPaste={handlePaste}
              focused={true}
              flexGrow={1}
              backgroundColor={themeCtx.theme.background}
              focusedBackgroundColor={themeCtx.theme.background}
              textColor={themeCtx.theme.text}
              focusedTextColor={themeCtx.theme.text}
              cursorColor={isInteractive() ? themeCtx.theme.primary : themeCtx.theme.textMuted}
            />
          </Show>
        </box>

        {/* Hint */}
        <Show when={getHint()}>
          <text fg={themeCtx.theme.textMuted}> {getHint()}</text>
        </Show>
      </box>
    </box>
  )
}
