/** @jsxImportSource @opentui/solid */
/**
 * Log Line Component
 *
 * Renders a single log line with rich formatting support:
 * - Colors: gray, green, red, orange, cyan, magenta, blue, yellow
 * - Attributes: bold, dim, italic, underline, inverse, strikethrough
 * - Combined markers: [GREEN:BOLD], [RED:UNDERLINE,BOLD], etc.
 *
 * Uses the enhanced parseMarker system for professional CLI output.
 */

import { createMemo } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { parseMarker, type ParsedMarker } from "../../../../../../shared/formatters/outputMarkers.js"

export interface LogLineProps {
  line: string
  maxWidth?: number
}

/**
 * Map attribute names to OpenTUI TextAttributes flags
 */
function getTextAttributes(parsed: ParsedMarker): number {
  let attrs = TextAttributes.NONE

  if (parsed.attributes.has('bold')) {
    attrs |= TextAttributes.BOLD
  }
  if (parsed.attributes.has('dim')) {
    attrs |= TextAttributes.DIM
  }
  if (parsed.attributes.has('italic')) {
    attrs |= TextAttributes.ITALIC
  }
  if (parsed.attributes.has('underline')) {
    attrs |= TextAttributes.UNDERLINE
  }
  if (parsed.attributes.has('inverse')) {
    attrs |= TextAttributes.INVERSE
  }
  if (parsed.attributes.has('strikethrough')) {
    attrs |= TextAttributes.STRIKETHROUGH
  }

  return attrs
}

/**
 * Single log line with rich formatting using parseMarker
 */
export function LogLine(props: LogLineProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()

  // Calculate max width for a log line (65% panel width minus padding)
  const maxWidth = createMemo(() => {
    if (props.maxWidth) return props.maxWidth
    const termWidth = dimensions()?.width ?? 120
    // Output panel is 65% width, -6 for padding
    return Math.floor(termWidth * 0.65) - 6
  })

  // Parse color and attribute markers from log line
  const parsed = createMemo(() => parseMarker(props.line))

  // Map marker colors to theme colors
  const lineColor = createMemo(() => {
    const color = parsed().color
    switch (color) {
      case "green": return themeCtx.theme.success
      case "red": return themeCtx.theme.error
      case "orange": return themeCtx.theme.warning
      case "yellow": return themeCtx.theme.warning
      case "cyan": return themeCtx.theme.info
      case "blue": return themeCtx.theme.info
      case "gray": return themeCtx.theme.textMuted
      case "magenta": return themeCtx.theme.purple
      default: return themeCtx.theme.text
    }
  })

  // Check if this is a user input line (magenta) - show with background
  const isUserInput = () => parsed().color === "magenta"

  // Compute text attributes bitmask
  const textAttrs = createMemo(() => getTextAttributes(parsed()))

  // Strip ANSI codes from display text
  const displayText = createMemo(() => {
    let text = parsed().text
    // Strip any remaining ANSI codes
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\x1b\[[0-9;]*m/g, "")
    return text
  })

  return (
    <text
      fg={lineColor()}
      bg={isUserInput() ? themeCtx.theme.backgroundElement : undefined}
      attributes={textAttrs()}
      width={maxWidth()}
    >
      {displayText()}
    </text>
  )
}

/**
 * LogLine variant for inline/compact display (no width constraints)
 */
export function LogLineInline(props: { line: string }) {
  const themeCtx = useTheme()

  const parsed = createMemo(() => parseMarker(props.line))

  const lineColor = createMemo(() => {
    const color = parsed().color
    switch (color) {
      case "green": return themeCtx.theme.success
      case "red": return themeCtx.theme.error
      case "orange": return themeCtx.theme.warning
      case "yellow": return themeCtx.theme.warning
      case "cyan": return themeCtx.theme.info
      case "blue": return themeCtx.theme.info
      case "gray": return themeCtx.theme.textMuted
      case "magenta": return themeCtx.theme.purple
      default: return themeCtx.theme.text
    }
  })

  const textAttrs = createMemo(() => getTextAttributes(parsed()))

  const displayText = createMemo(() => {
    let text = parsed().text
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\x1b\[[0-9;]*m/g, "")
    return text
  })

  return (
    <text
      fg={lineColor()}
      attributes={textAttrs()}
    >
      {displayText()}
    </text>
  )
}
