/** @jsxImportSource @opentui/solid */
/**
 * Status Footer Component
 * Ported from: src/ui/components/StatusFooter.tsx
 *
 * Show keyboard shortcuts at bottom of screen
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface StatusFooterProps {
  autonomousMode?: boolean
}

/**
 * Show keyboard shortcuts at bottom of screen
 */
export function StatusFooter(props: StatusFooterProps) {
  const themeCtx = useTheme()

  return (
    <box paddingLeft={1} paddingRight={1}>
      <text fg={themeCtx.theme.textMuted}>
        [↑↓] Navigate  [ENTER] Expand/View  [Tab] Toggle Panel  [H] History  [P] Pause  [Ctrl+S] Skip  [Esc] Stop
      </text>
      <Show when={props.autonomousMode}>
        <text fg={themeCtx.theme.primary}>  [Shift+Tab] Disable Auto</text>
      </Show>
    </box>
  )
}
