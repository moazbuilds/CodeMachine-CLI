/** @jsxImportSource @opentui/solid */
/**
 * Stop Confirmation Modal
 *
 * Asks user to confirm stopping the workflow.
 */

import { createSignal } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ModalBase, ModalHeader, ModalFooter } from "@tui/shared/components/modal"

export interface StopModalProps {
  onConfirm: () => void
  onCancel: () => void
}

type ButtonType = "yes" | "no"

export function StopModal(props: StopModalProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [selectedButton, setSelectedButton] = createSignal<ButtonType>("no")

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
      <ModalHeader title="Stop Workflow" icon="!" iconColor={themeCtx.theme.error} />
      <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
        <text fg={themeCtx.theme.text}>Do you really want to stop the workflow?</text>
      </box>
      <box flexDirection="row" justifyContent="center" gap={2} paddingBottom={1}>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={selectedButton() === "yes" ? themeCtx.theme.error : themeCtx.theme.backgroundElement}
          borderColor={selectedButton() === "yes" ? themeCtx.theme.error : themeCtx.theme.borderSubtle}
          border
        >
          <text fg={selectedButton() === "yes" ? themeCtx.theme.background : themeCtx.theme.text}>Yes</text>
        </box>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={selectedButton() === "no" ? themeCtx.theme.success : themeCtx.theme.backgroundElement}
          borderColor={selectedButton() === "no" ? themeCtx.theme.success : themeCtx.theme.borderSubtle}
          border
        >
          <text fg={selectedButton() === "no" ? themeCtx.theme.background : themeCtx.theme.text}>No</text>
        </box>
      </box>
      <ModalFooter shortcuts="[Left/Right] Navigate  [ENTER] Confirm  [Y/N] Direct  [Esc] Cancel" />
    </ModalBase>
  )
}
