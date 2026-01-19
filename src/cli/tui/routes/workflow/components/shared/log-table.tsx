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

export interface LogTableProps {
  /** Raw markdown table lines */
  lines: string[]
  /** Optional max width constraint */
  maxWidth?: number
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
          // First line (header row after top border) gets bold
          const isHeaderRow = () => index() === 1 && renderedLines().length > 3

          return (
            <text
              fg={themeCtx.theme.text}
              attributes={isHeaderRow() ? TextAttributes.BOLD : TextAttributes.NONE}
            >
              {line}
            </text>
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

  // Detect which parts of a line are borders vs content
  const parseLine = (line: string) => {
    const segments: { text: string; isBorder: boolean }[] = []
    let current = ''
    let isBorder = false
    const borderChars = new Set(['┌', '┐', '└', '┘', '┬', '┴', '├', '┤', '┼', '─', '│'])

    for (const char of line) {
      const charIsBorder = borderChars.has(char)
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

  return (
    <box flexDirection="column">
      <For each={renderedLines()}>
        {(line, index) => {
          const segments = parseLine(line)
          const isHeaderRow = () => index() === 1 && renderedLines().length > 3

          return (
            <box flexDirection="row">
              <For each={segments}>
                {(segment) => (
                  <text
                    fg={segment.isBorder
                      ? (props.borderColor ?? themeCtx.theme.textMuted)
                      : themeCtx.theme.text
                    }
                    attributes={isHeaderRow() && !segment.isBorder
                      ? TextAttributes.BOLD
                      : TextAttributes.NONE
                    }
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
