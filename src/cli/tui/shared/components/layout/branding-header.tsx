/** @jsxImportSource @opentui/solid */
import type { JSX } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { SIMPLE_LOGO } from "../logo"

export function BrandingHeader(props: { version: string; currentDir: string }) {
  const themeCtx = useTheme()

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingBottom={1}>
      <text> </text>
      <text fg={themeCtx.theme.primary}>
        {` ${SIMPLE_LOGO[0]}  `}
        <span style={{ fg: themeCtx.theme.textMuted }}>v{props.version}</span>
      </text>
      <text fg={themeCtx.theme.primary}>
        {` ${SIMPLE_LOGO[1]}  `}
        <span style={{ fg: themeCtx.theme.textMuted }}>{props.currentDir}</span>
      </text>
    </box>
  )
}
