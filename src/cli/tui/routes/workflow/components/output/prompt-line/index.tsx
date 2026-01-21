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

import { createSignal, Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

import type { PromptLineProps, PromptLineState, ChainConfirmRequest } from "./types"
import { PromptLineHint } from "./prompt-line-hint"
import { PromptLineSymbol } from "./prompt-line-symbol"
import { useTypingEffect } from "./use-typing-effect"

// Re-export types
export type { PromptLineProps, PromptLineState, ChainConfirmRequest }

const LARGE_PASTE_THRESHOLD = 1000
const PLACEHOLDER = "Enter to continue or type prompt..."

type PendingPaste = { placeholder: string; content: string }

export function PromptLine(props: PromptLineProps) {
  const themeCtx = useTheme()
  const [input, setInput] = createSignal("")
  const [pendingPastes, setPendingPastes] = createSignal<PendingPaste[]>([])
  const [pendingSubmitValue, setPendingSubmitValue] = createSignal("")
  let pasteCounter = 0

  const isInteractive = () =>
    props.state.mode === "active" || props.state.mode === "chained"

  // Typing effect for placeholder animation
  const typingText = useTypingEffect({
    text: PLACEHOLDER,
    isActive: () => props.isFocused && isInteractive() && input() === "",
  })

  const getPlaceholder = () => {
    if (props.state.mode === "disabled") return "Workflow idle"
    if (props.state.mode === "passive") return "Agent working..."
    if (props.state.mode === "active") {
      if (props.state.reason === "paused") return "Type to steer or Enter to resume"
      return "Type to steer agent..."
    }
    if (props.state.mode === "chained") {
      return `Next: "${props.state.name}" (${props.state.index}/${props.state.total})`
    }
    return ""
  }

  const prepareSubmitValue = () => {
    let value = input().trim()

    // Replace placeholders with actual pasted content
    for (const { placeholder, content } of pendingPastes()) {
      value = value.replace(placeholder, content)
    }

    return value
  }

  const doSubmit = (value: string) => {
    // Clear paste state
    setPendingPastes([])
    pasteCounter = 0
    setInput("")

    // Submit (empty or with content)
    props.onSubmit(value)
  }

  const handleSubmit = () => {
    const value = prepareSubmitValue()

    // For chained prompts, show confirmation only if input is empty
    if (props.state.mode === "chained" && value === "") {
      setPendingSubmitValue(value)

      // Request confirmation via callback (modal rendered at top level)
      const nextStepInfo = getNextStepInfo()
      if (props.onShowChainConfirm) {
        props.onShowChainConfirm({
          stepIndex: nextStepInfo.index,
          stepName: nextStepInfo.name,
          stepDescription: nextStepInfo.description,
          totalSteps: nextStepInfo.total,
          onConfirm: () => {
            doSubmit(pendingSubmitValue())
            setPendingSubmitValue("")
          },
          onCancel: () => {
            setPendingSubmitValue("")
          },
        })
      }
      return
    }

    doSubmit(value)
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

    if (!cleanText) return
    evt.preventDefault?.()

    // Large paste: use placeholder to avoid UI slowdown
    if (cleanText.length > LARGE_PASTE_THRESHOLD) {
      pasteCounter++
      const placeholder = `[Pasted Content ${cleanText.length} chars${pasteCounter > 1 ? ` #${pasteCounter}` : ""}]`
      setPendingPastes((prev) => [...prev, { placeholder, content: cleanText }])
      setInput((prev) => prev + placeholder)
    } else {
      setInput((prev) => prev + cleanText)
    }
  }

  // Always show input when focused (for stability), but only allow typing when interactive
  const showInput = () => props.isFocused

  // Get next step info for confirmation modal
  const getNextStepInfo = () => {
    if (props.state.mode === "chained") {
      return {
        index: props.state.index + 1,
        name: props.state.nextStepName,
        description: props.state.description,
        total: props.state.total,
      }
    }
    return { index: 0, name: "", description: "", total: 0 }
  }

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
          <PromptLineSymbol state={props.state} />

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
        <PromptLineHint state={props.state} isInteractive={isInteractive()} />
      </box>
    </box>
  )
}
