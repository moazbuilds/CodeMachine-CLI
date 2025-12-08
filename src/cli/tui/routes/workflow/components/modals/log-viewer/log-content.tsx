/** @jsxImportSource @opentui/solid */
/**
 * Log Content Component
 *
 * Displays scrollable log lines with OpenTUI scrollbox.
 */

import { Show, For } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { LogLine } from "../../shared/log-line"

export interface LogContentProps {
  lines: string[]
  isLoading: boolean
  isConnecting: boolean
  error: string | null
  visibleHeight: number
  isRunning?: boolean
}

export function LogContent(props: LogContentProps) {
  const themeCtx = useTheme()

  return (
    <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1}>
      <Show when={props.isLoading}>
        <box justifyContent="center" alignItems="center" height="100%">
          <text fg={themeCtx.theme.text}>Loading logs...</text>
        </box>
      </Show>

      <Show when={props.isConnecting}>
        <box justifyContent="center" alignItems="center" height="100%">
          <text fg={themeCtx.theme.warning}>Connecting to agent log stream...</text>
        </box>
      </Show>

      <Show when={props.error}>
        <box justifyContent="center" alignItems="center" height="100%">
          <text fg={themeCtx.theme.error}>Error: {props.error}</text>
        </box>
      </Show>

      <Show when={!props.isLoading && !props.isConnecting && !props.error}>
        <Show
          when={props.lines.length > 0}
          fallback={
            <box justifyContent="center" alignItems="center" height="100%">
              <text fg={themeCtx.theme.textMuted}>Log file is empty</text>
            </box>
          }
        >
          <scrollbox
            height={props.visibleHeight}
            width="100%"
            stickyScroll={props.isRunning ?? true}
            stickyStart="bottom"
            scrollbarOptions={{
              showArrows: true,
              trackOptions: {
                foregroundColor: themeCtx.theme.info,
                backgroundColor: themeCtx.theme.borderSubtle,
              },
            }}
            viewportCulling={true}
            focused={true}
          >
            <For each={props.lines}>
              {(line) => <LogLine line={line || " "} />}
            </For>
          </scrollbox>
        </Show>
      </Show>
    </box>
  )
}
