/** @jsxImportSource @opentui/solid */
/**
 * Status Footer Component
 * Ported from: src/ui/components/StatusFooter.tsx
 *
 * Show keyboard shortcuts at bottom of screen
 */

import { useTheme } from "@tui/shared/context/theme"

import type { AutonomousMode, WorkflowView } from "../../state/types"

export interface StatusFooterProps {
  autonomousMode?: AutonomousMode
  view?: WorkflowView
  hasController?: boolean
}

/**
 * Show keyboard shortcuts at bottom of screen
 */
export function StatusFooter(props: StatusFooterProps) {
  const themeCtx = useTheme()

  const autoText = () => {
    switch (props.autonomousMode) {
      case 'never': return '' // No toggle available
      case 'always': return '' // No toggle available
      case 'true': return '[Shift+Tab] Disable Auto'
      case 'false': return '[Shift+Tab] Enable Auto'
      default: return '[Shift+Tab] Enable Auto'
    }
  }

  // Show controller shortcut only during executing view if workflow has a controller
  const controllerText = () =>
    (props.view === 'executing' && props.hasController) ? '[R] Controller  ' : ''

  return (
    <box paddingLeft={1} paddingRight={1}>
      <text fg={themeCtx.theme.textMuted}>
        [↑↓] Navigate  [ENTER] Expand/View  [Tab] Toggle Panel  [H] History  [P] Pause  [Ctrl+S] Skip  {controllerText()}[Esc] Stop  {autoText()}
      </text>
    </box>
  )
}
