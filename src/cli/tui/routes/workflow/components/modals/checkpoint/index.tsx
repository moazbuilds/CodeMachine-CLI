/** @jsxImportSource @opentui/solid */
/**
 * Checkpoint Modal Component
 *
 * Full-screen modal that pauses workflow for manual review.
 */

import { createSignal } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ModalBase, ModalHeader, ModalFooter } from "@tui/shared/components/modal"
import { CheckpointContent } from "./checkpoint-content"
import { CheckpointActions, type CheckpointButtonType } from "./checkpoint-actions"

export interface CheckpointModalProps {
  reason?: string
  onContinue: () => void
  onQuit: () => void
}

export function CheckpointModal(props: CheckpointModalProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [selectedButton, setSelectedButton] = createSignal<CheckpointButtonType>("continue")

  const modalWidth = () => {
    const safeWidth = Math.max(40, (dimensions()?.width ?? 80) - 8)
    return Math.min(safeWidth, 80)
  }

  useKeyboard((evt) => {
    if (evt.name === "left" || evt.name === "right") {
      evt.preventDefault()
      setSelectedButton((prev) => (prev === "continue" ? "quit" : "continue"))
      return
    }

    if (evt.name === "return") {
      evt.preventDefault()
      if (selectedButton() === "continue") {
        props.onContinue()
      } else {
        props.onQuit()
      }
      return
    }

    if (evt.name === "c") {
      evt.preventDefault()
      props.onContinue()
      return
    }
    if (evt.name === "q") {
      evt.preventDefault()
      props.onQuit()
      return
    }
  })

  return (
    <ModalBase width={modalWidth()}>
      <ModalHeader title="CHECKPOINT - Review Required" icon="#" iconColor={themeCtx.theme.warning} />
      <CheckpointContent reason={props.reason} modalWidth={modalWidth()} />
      <CheckpointActions
        selectedButton={selectedButton()}
        onContinue={props.onContinue}
        onQuit={props.onQuit}
      />
      <ModalFooter shortcuts="[Left/Right] Navigate  [ENTER] Confirm  [C/Q] Direct" />
    </ModalBase>
  )
}
