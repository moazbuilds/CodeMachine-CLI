/** @jsxImportSource @opentui/solid */
/**
 * UI Element Node Component
 * Ported from: src/ui/components/UIElementNode.tsx
 *
 * Display a UI element (static message) in the timeline
 * Shows text with subtle gray separators: ──── Text ────
 */

import { useTheme } from "@tui/context/theme"
import type { UIElement } from "@tui/state/types"

export interface UIElementNodeProps {
  uiElement: UIElement
}

export function UIElementNode(props: UIElementNodeProps) {
  const themeCtx = useTheme()

  const separatorLength = 4
  const separator = "─".repeat(separatorLength)

  return (
    <box paddingLeft={1} paddingRight={1}>
      <text fg={themeCtx.theme.textMuted}>
        {separator} {props.uiElement.text} {separator}
      </text>
    </box>
  )
}
