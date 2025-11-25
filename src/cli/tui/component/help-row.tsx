/** @jsxImportSource @opentui/solid */
import { useTheme } from "@tui/context/theme"

export interface HelpRowProps {
  command: string
  description: string
}

export function HelpRow(props: HelpRowProps) {
  const themeCtx = useTheme()

  return (
    <box flexDirection="row" gap={2}>
      <box width={14}>
        <text fg={themeCtx.theme.primary}>/{props.command}</text>
      </box>
      <box>
        <text fg={themeCtx.theme.textMuted}>{props.description}</text>
      </box>
    </box>
  )
}
