/** @jsxImportSource @opentui/solid */
/**
 * Log Footer Component
 *
 * Total lines count and keyboard shortcuts.
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface LogFooterProps {
  total: number
  isRunning: boolean
  hasMoreAbove?: boolean
}

export function LogFooter(props: LogFooterProps) {
  const themeCtx = useTheme()

  return (
    <>
      <Show when={props.total > 0}>
        <box paddingLeft={1} paddingRight={1} flexDirection="row">
          <Show when={props.hasMoreAbove}>
            <text fg={themeCtx.theme.textMuted}>... </text>
          </Show>
          <text fg={themeCtx.theme.textMuted}>
            {props.total} lines
          </text>
          <Show when={props.isRunning}>
            <text fg={themeCtx.theme.warning}> • Live</text>
          </Show>
        </box>
      </Show>
      <box paddingLeft={1} paddingRight={1}>
        <text fg={themeCtx.theme.textMuted}>
          [Esc] Close  [Up/Down] Scroll
          <Show when={props.hasMoreAbove}>  [g] Load earlier</Show>
        </text>
      </box>
    </>
  )
}
