/** @jsxImportSource @opentui/solid */
/**
 * Status Footer Component
 * Ported from: src/ui/components/StatusFooter.tsx
 *
 * Show keyboard shortcuts at bottom of screen
 */

import { useTheme } from "@tui/shared/context/theme"

export interface StatusFooterProps {
  autonomousMode?: boolean
  isControllerActive?: boolean
}

/**
 * Show keyboard shortcuts at bottom of screen
 * Displays different shortcuts in Controller mode vs Regular mode
 */
export function StatusFooter(props: StatusFooterProps) {
  const themeCtx = useTheme()

  // Controller mode: Conversation with some controls
  const controllerShortcuts = `[Enter] Start Workflow  [→] Focus Input  [Tab] Panel  [P] Pause  [H] History  [Esc] Exit`

  // Regular mode: Full navigation and control shortcuts
  const regularShortcuts = `[↑↓] Navigate  [ENTER] Expand/View  [Tab] Toggle Panel  [H] History  [P] Pause  [Ctrl+S] Skip  [Esc] Stop  [Shift+Tab] ${props.autonomousMode ? 'Disable' : 'Enable'}`

  return (
    <box paddingLeft={1} paddingRight={1}>
      <text fg={themeCtx.theme.textMuted}>
        {props.isControllerActive ? controllerShortcuts : regularShortcuts}
      </text>
    </box>
  )
}
