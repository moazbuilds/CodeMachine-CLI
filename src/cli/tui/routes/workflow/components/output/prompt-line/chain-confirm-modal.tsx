/** @jsxImportSource @opentui/solid */
/**
 * Chain Confirm Modal
 *
 * Confirmation modal shown when transitioning between chained prompt steps.
 * Warns user that they cannot return to the previous step.
 */

import { createSignal } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ModalBase, ModalFooter } from "@tui/shared/components/modal"

export interface ChainConfirmModalProps {
  stepIndex: number
  stepName: string
  stepDescription: string
  totalSteps: number
  onConfirm: () => void
  onCancel: () => void
}

export function ChainConfirmModal(props: ChainConfirmModalProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [selectedButton, setSelectedButton] = createSignal<"yes" | "no">("yes")

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
        <text fg={themeCtx.theme.warning} attributes={1}>▲ Confirm Step Transition</text>
      </box>
      <box paddingLeft={1} paddingRight={1} paddingBottom={1} flexDirection="column">
        <text fg={themeCtx.theme.text}>
          Are you sure you want to proceed to step {props.stepIndex}/{props.totalSteps}?
        </text>
        <box height={1} />
        <text fg={themeCtx.theme.primary} attributes={1}>{props.stepName}</text>
        <text fg={themeCtx.theme.textMuted}>{props.stepDescription}</text>
        <box height={1} />
        <text fg={themeCtx.theme.textMuted}>
          You cannot return to the previous step once you proceed.
        </text>
      </box>
      <box flexDirection="row" justifyContent="center" gap={2} paddingBottom={1}>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={selectedButton() === "yes" ? themeCtx.theme.success : themeCtx.theme.backgroundElement}
          borderColor={selectedButton() === "yes" ? themeCtx.theme.success : themeCtx.theme.borderSubtle}
          border
        >
          <text fg={selectedButton() === "yes" ? themeCtx.theme.background : themeCtx.theme.text}>Yes, Proceed</text>
        </box>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={selectedButton() === "no" ? themeCtx.theme.warning : themeCtx.theme.backgroundElement}
          borderColor={selectedButton() === "no" ? themeCtx.theme.warning : themeCtx.theme.borderSubtle}
          border
        >
          <text fg={selectedButton() === "no" ? themeCtx.theme.background : themeCtx.theme.text}>Cancel</text>
        </box>
      </box>
      <ModalFooter shortcuts="[Left/Right] Navigate  [ENTER] Confirm  [Y/N] Direct  [Esc] Cancel" />
    </ModalBase>
  )
}
