/** @jsxImportSource @opentui/solid */
/**
 * Modal Header Component
 *
 * Title bar with optional icon and close button for modals.
 */

import { Show } from "solid-js"
import type { RGBA } from "@opentui/core"
import { useTheme } from "@tui/shared/context/theme"

export interface ModalHeaderProps {
  title: string
  icon?: string
  iconColor?: string | RGBA
  onClose?: () => void
}

export function ModalHeader(props: ModalHeaderProps) {
  const themeCtx = useTheme()

  return (
    <box flexDirection="row" justifyContent="space-between">
      <box flexDirection="row">
        <Show when={props.icon}>
          <text fg={props.iconColor ?? themeCtx.theme.warning} attributes={1}>
            {props.icon}{" "}
          </text>
        </Show>
        <text fg={themeCtx.theme.primary} attributes={1}>
          {props.title}
        </text>
      </box>
      <Show when={props.onClose}>
        <box onMouseDown={props.onClose}>
          <text fg={themeCtx.theme.textMuted}>[X]</text>
        </box>
      </Show>
    </box>
  )
}
