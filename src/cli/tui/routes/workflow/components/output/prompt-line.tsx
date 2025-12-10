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
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ModalBase, ModalFooter } from "@tui/shared/components/modal"

const LARGE_PASTE_THRESHOLD = 1000
type PendingPaste = { placeholder: string; content: string }

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

// Confirmation modal for chained prompts
interface ChainConfirmModalProps {
  stepIndex: number
  stepLabel: string
  totalSteps: number
  onConfirm: () => void
  onCancel: () => void
}

function ChainConfirmModal(props: ChainConfirmModalProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [selectedButton, setSelectedButton] = createSignal<"yes" | "no">("no")

  const modalWidth = () => {
    const safeWidth = Math.max(40, (dimensions()?.width ?? 80) - 8)
    return Math.min(safeWidth, 60)
  }

  useKeyboard((evt) => {
    if (evt.name === "left" || evt.name === "right") {
      evt.preventDefault()
      setSelectedButton((prev) => (prev === "yes" ? "no" : "yes"))
      return
    }

    if (evt.name === "return") {
      evt.preventDefault()
      if (selectedButton() === "yes") {
        props.onConfirm()
      } else {
        props.onCancel()
      }
      return
    }

    if (evt.name === "y") {
      evt.preventDefault()
      props.onConfirm()
      return
    }
    if (evt.name === "n" || evt.name === "escape") {
      evt.preventDefault()
      props.onCancel()
      return
    }
  })

  return (
    <ModalBase width={modalWidth()}>
      <box paddingBottom={1}>
        <text fg={themeCtx.theme.warning} attributes={1}>⚠ Confirm Step Transition</text>
      </box>
      <box paddingLeft={1} paddingRight={1} paddingBottom={1} flexDirection="column">
        <text fg={themeCtx.theme.text}>
          Are you sure you want to proceed to step {props.stepIndex}/{props.totalSteps}?
        </text>
        <box height={1} />
        <text fg={themeCtx.theme.primary} attributes={1}>"{props.stepLabel}"</text>
        <box height={1} />
        <text fg={themeCtx.theme.textMuted}>
          You cannot return to the previous step once you proceed.
        </text>
      </box>
      <box flexDirection="row" justifyContent="center" gap={2} paddingBottom={1}>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={selectedButton() === "yes" ? themeCtx.theme.warning : themeCtx.theme.backgroundElement}
          borderColor={selectedButton() === "yes" ? themeCtx.theme.warning : themeCtx.theme.borderSubtle}
          border
        >
          <text fg={selectedButton() === "yes" ? themeCtx.theme.background : themeCtx.theme.text}>Yes, Proceed</text>
        </box>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={selectedButton() === "no" ? themeCtx.theme.success : themeCtx.theme.backgroundElement}
          borderColor={selectedButton() === "no" ? themeCtx.theme.success : themeCtx.theme.borderSubtle}
          border
        >
          <text fg={selectedButton() === "no" ? themeCtx.theme.background : themeCtx.theme.text}>Cancel</text>
        </box>
      </box>
      <ModalFooter shortcuts="[Left/Right] Navigate  [ENTER] Confirm  [Y/N] Direct  [Esc] Cancel" />
    </ModalBase>
  )
}

export function PromptLine(props: PromptLineProps) {
  const themeCtx = useTheme()
  const [input, setInput] = createSignal("")
  const [typingText, setTypingText] = createSignal("")
  const [pendingPastes, setPendingPastes] = createSignal<PendingPaste[]>([])
  const [showConfirm, setShowConfirm] = createSignal(false)
  const [pendingSubmitValue, setPendingSubmitValue] = createSignal("")
  let pasteCounter = 0

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

    // For chained prompts, show confirmation before proceeding
    if (props.state.mode === "chained") {
      setPendingSubmitValue(value)
      setShowConfirm(true)
      return
    }

    doSubmit(value)
  }

  const handleConfirm = () => {
    setShowConfirm(false)
    doSubmit(pendingSubmitValue())
    setPendingSubmitValue("")
  }

  const handleCancelConfirm = () => {
    setShowConfirm(false)
    setPendingSubmitValue("")
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

  // Get next step info for confirmation modal
  const getNextStepInfo = () => {
    if (props.state.mode === "chained") {
      return {
        index: props.state.index + 1,
        label: props.state.label,
        total: props.state.total,
      }
    }
    return { index: 0, label: "", total: 0 }
  }

  return (
    <>
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
                focused={!showConfirm()}
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

      {/* Confirmation modal for chained prompts */}
      <Show when={showConfirm()}>
        <ChainConfirmModal
          stepIndex={getNextStepInfo().index}
          stepLabel={getNextStepInfo().label}
          totalSteps={getNextStepInfo().total}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      </Show>
    </>
  )
}
