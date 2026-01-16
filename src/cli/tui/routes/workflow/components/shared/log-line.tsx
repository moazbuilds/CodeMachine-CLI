/** @jsxImportSource @opentui/solid */
/**
 * Log Line Component
 *
 * Renders a single log line with rich formatting support:
 * - Colors: gray, green, red, orange, cyan, magenta, blue, yellow
 * - Attributes: bold, dim, italic, underline, inverse, strikethrough
 * - Combined markers: [GREEN:BOLD], [RED:UNDERLINE,BOLD], etc.
 * - Line prefix formatting: * for bold highlight, - for bullet points
 *
 * Uses the enhanced parseMarker system for professional CLI output.
 */

import { createMemo, Show, For } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { useUIState } from "../../context/ui-state"
import { parseMarker, type ParsedMarker } from "../../../../../../shared/formatters/outputMarkers.js"

/**
 * Detect line prefix type for special formatting
 * Returns: 'star' for * prefix, 'bullet' for - prefix, null otherwise
 */
function detectLinePrefix(text: string): { type: 'star' | 'bullet' | null; content: string } {
  const trimmed = text.trimStart()
  const indent = text.length - trimmed.length
  const indentStr = text.slice(0, indent)

  // Check for "* " prefix (star/highlight)
  if (trimmed.startsWith('* ')) {
    return { type: 'star', content: indentStr + trimmed.slice(2) }
  }
  // Check for "- " prefix (bullet point)
  if (trimmed.startsWith('- ')) {
    return { type: 'bullet', content: indentStr + trimmed.slice(2) }
  }
  return { type: null, content: text }
}

/**
 * Word-wrap text to fit within maxWidth, breaking at word boundaries
 */
function wordWrap(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0 || text.length <= maxWidth) {
    return [text]
  }

  const lines: string[] = []
  const words = text.split(' ')
  let currentLine = ''

  for (const word of words) {
    if (currentLine.length === 0) {
      // First word on line - add it even if too long
      currentLine = word
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      // Word fits on current line
      currentLine += ' ' + word
    } else {
      // Word doesn't fit - start new line
      lines.push(currentLine)
      currentLine = word
    }
  }

  // Don't forget the last line
  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  return lines.length > 0 ? lines : ['']
}

export interface LogLineProps {
  line: string
  maxWidth?: number
}

/**
 * Styled text segment from inline markdown parsing
 */
interface TextSegment {
  text: string
  bold?: boolean
  code?: boolean
}

/**
 * Parse inline markdown and return styled segments
 * Handles **bold** and `code` patterns
 */
function parseInlineMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) })
    }
    if (match[2]) {
      segments.push({ text: match[2], bold: true })
    } else if (match[3]) {
      segments.push({ text: match[3], code: true })
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) })
  }
  return segments.length ? segments : [{ text }]
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
  const ui = useUIState()

  // Calculate max width for a log line dynamically based on timeline state
  const maxWidth = createMemo(() => {
    if (props.maxWidth) return props.maxWidth
    const termWidth = dimensions()?.width ?? 120
    const isFullWidth = ui.state().timelineCollapsed || ui.state().view === 'controller'
    // Full width when timeline collapsed or in controller view, otherwise 65% for split view
    const widthRatio = isFullWidth ? 1 : 0.65
    return Math.floor(termWidth * widthRatio) - 6
  })

  // Parse color and attribute markers from log line
  const parsed = createMemo(() => parseMarker(props.line))

  // Detect line prefix after marker parsing
  const prefixInfo = createMemo(() => detectLinePrefix(parsed().text))

  // Map marker colors to theme colors
  const lineColor = createMemo(() => {
    const color = parsed().color
    switch (color) {
      case "green": return themeCtx.theme.success
      case "red": return themeCtx.theme.error
      case "orange": return themeCtx.theme.warning
      case "yellow": return themeCtx.theme.warning
      case "cyan": return themeCtx.theme.info
      case "blue": return themeCtx.theme.blue
      case "gray": return themeCtx.theme.textMuted
      case "magenta": return themeCtx.theme.purple
      default: return themeCtx.theme.text
    }
  })

  // Check if this is a user input line (magenta) - show with background
  const isUserInput = () => parsed().color === "magenta"

  // Check if this is controller output (blue) - show with distinct background
  const isControllerOutput = () => parsed().color === "blue"

  // Compute text attributes bitmask (add bold for star prefix)
  const textAttrs = createMemo(() => {
    let attrs = getTextAttributes(parsed())
    if (prefixInfo().type === 'star') {
      attrs |= TextAttributes.BOLD
    }
    return attrs
  })

  // Strip ANSI codes from display text
  const displayText = createMemo(() => {
    let text = prefixInfo().content
    // Strip any remaining ANSI codes
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\x1b\[[0-9;]*m/g, "")
    return text
  })

  // Get prefix symbol for bullet points
  const bulletSymbol = () => prefixInfo().type === 'bullet' ? '• ' : ''
  const bulletWidth = () => prefixInfo().type === 'bullet' ? 2 : 0

  // Word-wrapped lines (wrap the raw text, then parse segments per line)
  const wrappedLines = createMemo(() => {
    const width = maxWidth() - bulletWidth()
    return wordWrap(displayText(), width)
  })

  // Get background color for the line
  const bgColor = () => {
    if (isUserInput()) return themeCtx.theme.backgroundElement
    if (isControllerOutput()) return themeCtx.theme.controllerBackground
    return undefined
  }

  return (
    <box flexDirection="column" width={maxWidth()}>
      <For each={wrappedLines()}>
        {(line, index) => {
          const lineSegments = parseInlineMarkdown(line)
          return (
            <box flexDirection="row">
              <Show when={prefixInfo().type === 'bullet' && index() === 0}>
                <text fg={themeCtx.theme.textMuted}>{bulletSymbol()}</text>
              </Show>
              <Show when={prefixInfo().type === 'bullet' && index() > 0}>
                <text>  </text>
              </Show>
              <For each={lineSegments}>
                {(segment) => (
                  <text
                    fg={segment.code ? themeCtx.theme.purple : lineColor()}
                    bg={bgColor()}
                    attributes={segment.bold ? (textAttrs() | TextAttributes.BOLD) : textAttrs()}
                  >
                    {segment.text}
                  </text>
                )}
              </For>
            </box>
          )
        }}
      </For>
    </box>
  )
}

/**
 * LogLine variant for inline/compact display (no width constraints)
 */
export function LogLineInline(props: { line: string }) {
  const themeCtx = useTheme()

  const parsed = createMemo(() => parseMarker(props.line))

  // Detect line prefix after marker parsing
  const prefixInfo = createMemo(() => detectLinePrefix(parsed().text))

  const lineColor = createMemo(() => {
    const color = parsed().color
    switch (color) {
      case "green": return themeCtx.theme.success
      case "red": return themeCtx.theme.error
      case "orange": return themeCtx.theme.warning
      case "yellow": return themeCtx.theme.warning
      case "cyan": return themeCtx.theme.info
      case "blue": return themeCtx.theme.blue
      case "gray": return themeCtx.theme.textMuted
      case "magenta": return themeCtx.theme.purple
      default: return themeCtx.theme.text
    }
  })

  // Compute text attributes bitmask (add bold for star prefix)
  const textAttrs = createMemo(() => {
    let attrs = getTextAttributes(parsed())
    if (prefixInfo().type === 'star') {
      attrs |= TextAttributes.BOLD
    }
    return attrs
  })

  const displayText = createMemo(() => {
    let text = prefixInfo().content
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\x1b\[[0-9;]*m/g, "")
    return text
  })

  // Parse inline markdown segments
  const segments = createMemo(() => parseInlineMarkdown(displayText()))

  // Get prefix symbol for bullet points
  const bulletSymbol = () => prefixInfo().type === 'bullet' ? '• ' : ''

  return (
    <box flexDirection="row">
      <Show when={prefixInfo().type === 'bullet'}>
        <text fg={themeCtx.theme.textMuted}>{bulletSymbol()}</text>
      </Show>
      <For each={segments()}>
        {(segment) => (
          <text
            fg={segment.code ? themeCtx.theme.purple : lineColor()}
            attributes={segment.bold ? (textAttrs() | TextAttributes.BOLD) : textAttrs()}
          >
            {segment.text}
          </text>
        )}
      </For>
    </box>
  )
}
