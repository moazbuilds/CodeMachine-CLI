/** @jsxImportSource @opentui/solid */
/**
 * Shared LogLine Component
 *
 * Renders a single log line with syntax highlighting using parseMarker.
 * Used by both OutputWindow and LogViewer to ensure consistent styling.
 */

import { createMemo } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { parseMarker } from "../../../../../../shared/formatters/outputMarkers.js"

export interface LogLineProps {
  line: string
  maxWidth?: number
}

/**
 * Single log line with syntax highlighting using parseMarker
 */
export function LogLine(props: LogLineProps) {
  const themeCtx = useTheme()

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

  // Strip ANSI codes and truncate to fit container
  const displayText = createMemo(() => {
    let text = parsed().text
    // Strip bold marker
    if (text.startsWith("===")) text = text.substring(3)
    // Strip any remaining ANSI codes
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\x1b\[[0-9;]*m/g, "")
    // Truncate if needed
    const max = props.maxWidth ?? 80
    return text.length > max ? text.slice(0, max - 3) + "..." : text
  })

  return <text fg={lineColor()} attributes={isBold() ? 1 : undefined}>{displayText()}</text>
}
