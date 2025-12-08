/** @jsxImportSource @opentui/solid */
/**
 * Pause Modal Component
 *
 * Modal shown when workflow is paused, allowing user to
 * enter a custom prompt to steer the agent on resume.
 */

import { createSignal } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ModalBase, ModalHeader, ModalContent, ModalFooter } from "@tui/shared/components/modal"
import { PauseInput } from "./pause-input"

export interface PauseModalProps {
  onResume: (prompt?: string) => void
  onCancel: () => void
}

export function PauseModal(props: PauseModalProps) {
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
      props.onCancel()
      return
    }
  })

  const handleSubmit = () => {
    const value = input().trim()
    props.onResume(value || undefined)
  }

  return (
    <ModalBase width={modalWidth()}>
      <ModalHeader title="PAUSED" icon="⏸" iconColor={themeCtx.theme.warning} />
      <ModalContent>
        <text fg={themeCtx.theme.textMuted}>
          Press [Esc] to resume, or type a prompt and press [Enter] to steer the agent.
        </text>
      </ModalContent>
      <PauseInput value={input()} onInput={setInput} onSubmit={handleSubmit} />
      <ModalFooter shortcuts="[Esc] Resume  •  [Enter] Steer with prompt" />
    </ModalBase>
  )
}
