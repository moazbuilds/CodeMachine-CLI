/** @jsxImportSource @opentui/solid */
/**
 * Shared LogLine Component
 *
 * Renders a single log line with syntax highlighting using parseMarker.
 * Used by both OutputWindow and LogViewer to ensure consistent styling.
 */

import { createMemo } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { parseMarker } from "../../../../../../shared/formatters/outputMarkers.js"

export interface LogLineProps {
  line: string
}

/**
 * Single log line with syntax highlighting using parseMarker
 */
export function LogLine(props: LogLineProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()

  // Calculate max width for a log line (65% panel width minus padding)
  const maxWidth = createMemo(() => {
    const termWidth = dimensions()?.width ?? 120
    // Output panel is 65% width, -6 for padding
    return Math.floor(termWidth * 0.65) - 6
  })

  // Parse color markers from log line
  const parsed = createMemo(() => parseMarker(props.line))

  // Map marker colors to theme colors
  const lineColor = createMemo(() => {
    const color = parsed().color
    if (color === "green") return themeCtx.theme.success
    if (color === "red") return themeCtx.theme.error
    if (color === "orange") return themeCtx.theme.warning
    if (color === "cyan") return themeCtx.theme.info
    if (color === "gray") return themeCtx.theme.textMuted
    return themeCtx.theme.text
  })

  // Check for bold marker (===)
  const isBold = () => parsed().text.startsWith("===")

  // Strip ANSI codes
  const displayText = createMemo(() => {
    let text = parsed().text
    // Strip bold marker
    if (text.startsWith("===")) text = text.substring(3)
    // Strip any remaining ANSI codes
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\x1b\[[0-9;]*m/g, "")
    return text
  })

  return <text fg={lineColor()} attributes={isBold() ? 1 : undefined} wrap width={maxWidth()}>{displayText()}</text>
}
