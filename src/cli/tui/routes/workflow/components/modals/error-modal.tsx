/** @jsxImportSource @opentui/solid */
/**
 * Error Modal
 *
 * Displays workflow errors.
 */

import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ModalBase, ModalHeader, ModalFooter } from "@tui/shared/components/modal"

export interface ErrorModalProps {
  message: string
  onClose: () => void
}

export function ErrorModal(props: ErrorModalProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()

  const modalWidth = () => {
    const safeWidth = Math.max(40, (dimensions()?.width ?? 80) - 8)
    return Math.min(safeWidth, 70)
  }

  useKeyboard((evt) => {
    if (evt.name === "return" || evt.name === "escape" || evt.name === "q") {
      evt.preventDefault()
      props.onClose()
      return
    }
  })

  return (
    <ModalBase width={modalWidth()}>
      <ModalHeader title="Workflow Error" icon="!" iconColor={themeCtx.theme.error} />
      <box
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={themeCtx.theme.error}>{props.message}</text>
        <text>{"\n\n"}Report issues: https://github.com/moazbuilds/CodeMachine-CLI/issues</text>
      </box>
      <box flexDirection="row" justifyContent="center" paddingBottom={1}>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={themeCtx.theme.textMuted}
          borderColor={themeCtx.theme.textMuted}
          border
        >
          <text fg={themeCtx.theme.background}>Close</text>
        </box>
      </box>
      <ModalFooter shortcuts="[ENTER/Esc/Q] Close" />
    </ModalBase>
  )
}
