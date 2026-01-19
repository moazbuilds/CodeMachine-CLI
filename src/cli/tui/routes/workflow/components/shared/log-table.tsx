/** @jsxImportSource @opentui/solid */
/**
 * Log Table Component
 *
 * Renders markdown tables with Unicode box-drawing characters.
 * Supports column alignment and theme-aware coloring.
 */

import { createMemo, For } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { useUIState } from "../../context/ui-state"
import { parseMarkdownTable, renderBoxTable } from "./markdown-table"
import { parseInlineMarkdown } from "./log-line"

export interface LogTableProps {
  /** Raw markdown table lines */
  lines: string[]
  /** Optional max width constraint */
  maxWidth?: number
}

// Box-drawing characters for detecting borders
const BORDER_CHARS = new Set(['┌', '┐', '└', '┘', '┬', '┴', '├', '┤', '┼', '─', '│'])

/**
 * Parse a line into border and content segments for styling
 */
function parseLineSegments(line: string): { text: string; isBorder: boolean }[] {
  const segments: { text: string; isBorder: boolean }[] = []
  let current = ''
  let isBorder = false

  for (const char of line) {
    const charIsBorder = BORDER_CHARS.has(char)
    if (charIsBorder !== isBorder && current) {
      segments.push({ text: current, isBorder })
      current = ''
    }
    isBorder = charIsBorder
    current += char
  }
  if (current) {
    segments.push({ text: current, isBorder })
  }
  return segments
}

/**
 * Renders a markdown table with box-drawing characters
 */
export function LogTable(props: LogTableProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const ui = useUIState()

  // Calculate max width for table (same pattern as LogLine)
  const maxWidth = createMemo(() => {
    if (props.maxWidth) return props.maxWidth
    const termWidth = dimensions()?.width ?? 120
    const isFullWidth = ui.state().timelineCollapsed || ui.state().view === 'controller'
    const widthRatio = isFullWidth ? 1 : 0.65
    return Math.floor(termWidth * widthRatio) - 6
  })

  // Parse and render the table with responsive wrapping
  const renderedLines = createMemo(() => {
    const parsed = parseMarkdownTable(props.lines)
    if (!parsed) {
      return props.lines
    }
    return renderBoxTable(parsed, maxWidth())
  })

  return (
    <box flexDirection="column">
      <For each={renderedLines()}>
        {(line, index) => {
          const segments = parseLineSegments(line)
          // First line (header row after top border) gets bold
          const isHeaderRow = () => index() === 1 && renderedLines().length > 3

          return (
            <box flexDirection="row">
              <For each={segments}>
                {(segment) => {
                  // For border segments, render as-is
                  if (segment.isBorder) {
                    return (
                      <text
                        fg={themeCtx.theme.textMuted}
                        attributes={TextAttributes.NONE}
                      >
                        {segment.text}
                      </text>
                    )
                  }
                  // For content segments, parse inline markdown
                  const inlineSegments = parseInlineMarkdown(segment.text)
                  return (
                    <For each={inlineSegments}>
                      {(inline) => (
                        <text
                          fg={inline.code ? themeCtx.theme.purple : themeCtx.theme.text}
                          attributes={
                            (isHeaderRow() || inline.bold)
                              ? TextAttributes.BOLD
                              : TextAttributes.NONE
                          }
                        >
                          {inline.text}
                        </text>
                      )}
                    </For>
                  )
                }}
              </For>
            </box>
          )
        }}
      </For>
    </box>
  )
}

/**
 * LogTable variant with custom border color
 */
export function LogTableStyled(props: LogTableProps & { borderColor?: number }) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const ui = useUIState()

  // Calculate max width for table (same pattern as LogLine)
  const maxWidth = createMemo(() => {
    if (props.maxWidth) return props.maxWidth
    const termWidth = dimensions()?.width ?? 120
    const isFullWidth = ui.state().timelineCollapsed || ui.state().view === 'controller'
    const widthRatio = isFullWidth ? 1 : 0.65
    return Math.floor(termWidth * widthRatio) - 6
  })

  // Parse and render the table with responsive wrapping
  const renderedLines = createMemo(() => {
    const parsed = parseMarkdownTable(props.lines)
    if (!parsed) {
      return props.lines
    }
    return renderBoxTable(parsed, maxWidth())
  })

  return (
    <box flexDirection="column">
      <For each={renderedLines()}>
        {(line, index) => {
          const segments = parseLineSegments(line)
          const isHeaderRow = () => index() === 1 && renderedLines().length > 3

          return (
            <box flexDirection="row">
              <For each={segments}>
                {(segment) => {
                  // For border segments, render as-is
                  if (segment.isBorder) {
                    return (
                      <text
                        fg={props.borderColor ?? themeCtx.theme.textMuted}
                        attributes={TextAttributes.NONE}
                      >
                        {segment.text}
                      </text>
                    )
                  }
                  // For content segments, parse inline markdown
                  const inlineSegments = parseInlineMarkdown(segment.text)
                  return (
                    <For each={inlineSegments}>
                      {(inline) => (
                        <text
                          fg={inline.code ? themeCtx.theme.purple : themeCtx.theme.text}
                          attributes={
                            (isHeaderRow() || inline.bold)
                              ? TextAttributes.BOLD
                              : TextAttributes.NONE
                          }
                        >
                          {inline.text}
                        </text>
                      )}
                    </For>
                  )
                }}
              </For>
            </box>
          )
        }}
      </For>
    </box>
  )
}
