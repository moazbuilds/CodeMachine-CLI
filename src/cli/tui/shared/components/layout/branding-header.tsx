/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { SIMPLE_LOGO } from "../logo"

export function BrandingHeader(props: { version: string; currentDir: string }) {
  const themeCtx = useTheme()

  const lines = () => [
    '',
    ` ${SIMPLE_LOGO[0]}`,
    ` ${SIMPLE_LOGO[1]}  v${props.version} ${props.currentDir}`,
  ]

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingBottom={1}>
      <For each={lines()}>
        {(line) => (
          <text fg={themeCtx.theme.primary}>{line}</text>
        )}
      </For>
    </box>
  )
}
