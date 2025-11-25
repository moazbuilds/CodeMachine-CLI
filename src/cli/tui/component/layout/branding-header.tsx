/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { useTheme } from "@tui/context/theme"

export function BrandingHeader(props: { version: string; currentDir: string }) {
  const themeCtx = useTheme()

  const lines = () => [
    " _____       _     _____         _   _",
    "|     |___ _| |___|     |___ ___| |_|_|___ ___",
    `|   --| . | . | -_| | | | .'|  _|   | |   | -_| v${props.version}`,
    `|_____|___|___|___|_|_|_|__,|___|_|_|_|_|_|___| ${props.currentDir}`,
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
