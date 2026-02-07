/** @jsxImportSource @opentui/solid */
/**
 * Ali Frame Component
 *
 * Matches the output-window.tsx style exactly:
 *
 *   ╭─
 *   │  (⌐■_■)    Ali | The CM Guy
 *   │  ↳ Text content here_
 *   ╰─
 */

import type { JSX } from 'solid-js'
import { useTheme } from '@tui/shared/context/theme'

export interface AliFrameProps {
  /** Current face expression (e.g., "(⌐■_■)") */
  face: string
  /** Children to render in the text area */
  children: JSX.Element
  /** Fixed width for the frame to prevent resizing during animation */
  width?: number
}

/**
 * Ali narrator frame with decorative border
 */
export function AliFrame(props: AliFrameProps) {
  const themeCtx = useTheme()
  const frameWidth = () => props.width ?? 40
  const compact = () => frameWidth() < 36
  const nameLabel = () => (compact() ? 'Ali' : 'Ali | The CM Guy')
  const nameSpacing = () => (compact() ? ' ' : '    ')

  return (
    <box flexDirection="column" paddingLeft={1} width={props.width}>
      {/* Top border */}
      <text fg={themeCtx.theme.border}>╭─</text>

      {/* Face + Name line */}
      <box flexDirection="row">
        <text fg={themeCtx.theme.border}>│  </text>
        <text fg={themeCtx.theme.text}>{props.face}</text>
        <text>{nameSpacing()}</text>
        <text fg={themeCtx.theme.text}>{nameLabel()}</text>
      </box>

      {/* Text content line with arrow */}
      <box flexDirection="row">
        <text fg={themeCtx.theme.border}>│  </text>
        <text fg={themeCtx.theme.textMuted}>↳ </text>
        {props.children}
      </box>

      {/* Bottom border */}
      <text fg={themeCtx.theme.border}>╰─</text>
    </box>
  )
}
