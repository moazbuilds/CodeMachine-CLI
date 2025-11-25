/** @jsxImportSource @opentui/solid */
/**
 * Status Footer Component
 * Ported from: src/ui/components/StatusFooter.tsx
 *
 * Show keyboard shortcuts at bottom of screen
 */

import { useTheme } from "@tui/shared/context/theme"

/**
 * Show keyboard shortcuts at bottom of screen
 */
export function StatusFooter() {
  const themeCtx = useTheme()

  return (
    <box paddingLeft={1} paddingRight={1}>
      <text fg={themeCtx.theme.textMuted}>
        [↑↓] Navigate  [ENTER] Expand/View Logs  [H] History  [Ctrl+S] Skip  [Ctrl+C] Exit
      </text>
    </box>
  )
}
