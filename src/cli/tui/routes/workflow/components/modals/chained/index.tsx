/** @jsxImportSource @opentui/solid */
/**
 * Chained Prompts Modal Component
 *
 * Modal shown when an agent completes and has chained prompts configured.
 * Allows user to:
 * 1. Type a custom prompt to steer the agent (same session)
 * 2. Click "Next Step" to feed the next chained prompt
 * 3. Skip all remaining chained prompts
 */

import { createSignal } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ModalBase, ModalHeader, ModalContent, ModalFooter } from "@tui/shared/components/modal"
import { PromptInput } from "@tui/shared/components/prompt-input"

export interface ChainedModalProps {
  currentIndex: number
  totalPrompts: number
  nextPromptLabel: string | null
  onCustomPrompt: (prompt: string) => void
  onNextStep: () => void
  onSkipAll: () => void
}

export function ChainedModal(props: ChainedModalProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [input, setInput] = createSignal("")

  const modalWidth = () => {
    const safeWidth = Math.max(50, (dimensions()?.width ?? 80) - 8)
    return Math.min(safeWidth, 80)
  }

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault()
      props.onSkipAll()
      return
    }
    if (evt.name === "n" && !input()) {
      evt.preventDefault()
      props.onNextStep()
      return
    }
  })

  const handleSubmit = () => {
    const value = input().trim()
    if (value) {
      props.onCustomPrompt(value)
    }
  }

  const hasMorePrompts = () => props.currentIndex < props.totalPrompts

  return (
    <ModalBase width={modalWidth()}>
      <ModalHeader title="CHAINED PROMPTS" icon="⛓" iconColor={themeCtx.theme.primary} />
      <ModalContent>
        {hasMorePrompts() ? (
          <box flexDirection="column" gap={1}>
            <text fg={themeCtx.theme.text}>
              Next: "{props.nextPromptLabel}" ({props.currentIndex + 1}/{props.totalPrompts})
            </text>
            <text fg={themeCtx.theme.textMuted}>
              Type a custom prompt or press [N] to continue with the next step.
            </text>
          </box>
        ) : (
          <box flexDirection="column" gap={1}>
            <text fg={themeCtx.theme.text}>
              All chained prompts completed ({props.totalPrompts}/{props.totalPrompts})
            </text>
            <text fg={themeCtx.theme.textMuted}>
              Type a custom prompt or press [N] to continue to next agent.
            </text>
          </box>
        )}
      </ModalContent>
      <PromptInput value={input()} onInput={setInput} onSubmit={handleSubmit} placeholder="Type custom prompt..." />
      <ModalFooter shortcuts="[Enter] Send  [N] Next Step  [Esc] Skip All" />
    </ModalBase>
  )
}
