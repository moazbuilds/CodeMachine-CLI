/** @jsxImportSource @opentui/solid */
/**
 * Separator Node Component
 *
 * Display a visual separator in the timeline
 * Shows text with subtle gray decorators: ──── Text ────
 */

import { useTheme } from "@tui/shared/context/theme"
import type { SeparatorItem } from "../../state/types"

export interface SeparatorNodeProps {
  separator: SeparatorItem
}

export function SeparatorNode(props: SeparatorNodeProps) {
  const themeCtx = useTheme()

  const decoratorLength = 4
  const decorator = "─".repeat(decoratorLength)

  return (
    <box paddingLeft={1} paddingRight={1}>
      <text fg={themeCtx.theme.mutedBlue}>
        {decorator} {props.separator.text} {decorator}
      </text>
    </box>
  )
}
