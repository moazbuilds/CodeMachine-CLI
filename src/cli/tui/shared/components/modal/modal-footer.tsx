/** @jsxImportSource @opentui/solid */
/**
 * Modal Footer Component
 *
 * Keyboard shortcuts and help text for modals.
 */

import { useTheme } from "@tui/shared/context/theme"

export interface ModalFooterProps {
  shortcuts: string
}

export function ModalFooter(props: ModalFooterProps) {
  const themeCtx = useTheme()

  return (
    <box paddingTop={1} flexDirection="row" justifyContent="center">
      <text fg={themeCtx.theme.textMuted}>{props.shortcuts}</text>
    </box>
  )
}
