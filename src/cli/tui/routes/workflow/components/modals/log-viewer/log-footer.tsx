/** @jsxImportSource @opentui/solid */
/**
 * Log Footer Component
 *
 * Scroll position and keyboard shortcuts.
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface LogFooterProps {
  startLine: number
  endLine: number
  total: number
  percentage: number
  isRunning: boolean
}

export function LogFooter(props: LogFooterProps) {
  const themeCtx = useTheme()

  return (
    <>
      <Show when={props.total > 0}>
        <box paddingLeft={1} paddingRight={1} flexDirection="row">
          <text fg={themeCtx.theme.textMuted}>
            Lines {props.startLine}-{props.endLine} of {props.total} ({props.percentage}%)
          </text>
          <Show when={props.isRunning}>
            <text fg={themeCtx.theme.warning}> Live updates enabled</text>
          </Show>
        </box>
      </Show>
      <box paddingLeft={1} paddingRight={1}>
        <text fg={themeCtx.theme.textMuted}>
          [Esc] Close  [Up/Down] Scroll  [PgUp/PgDn] Page  [g/G] Top/Bottom
        </text>
      </box>
    </>
  )
}
