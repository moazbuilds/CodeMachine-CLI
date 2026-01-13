/** @jsxImportSource @opentui/solid */
/**
 * Log Table Component
 *
 * Renders markdown tables with Unicode box-drawing characters.
 * Supports column alignment and theme-aware coloring.
 */

import { createMemo, For } from "solid-js"
import { TextAttributes, type RGBA } from "@opentui/core"
import { useTheme } from "@tui/shared/context/theme"
import { parseMarkdownTable, renderBoxTable } from "./markdown-table"

export interface LogTableProps {
  /** Raw markdown table lines */
  lines: string[]
}

/**
 * Renders a markdown table with box-drawing characters
 */
export function LogTable(props: LogTableProps) {
  const themeCtx = useTheme()

  // Parse and render the table
  const renderedLines = createMemo(() => {
    const parsed = parseMarkdownTable(props.lines)
    if (!parsed) {
      // Fallback to original lines if parsing fails
      return props.lines
    }
    return renderBoxTable(parsed)
  })

  return (
    <box flexDirection="column">
      <For each={renderedLines()}>
        {(line, index) => {
          // First line (header row after top border) gets bold
          // Box characters get muted color, content gets normal color
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

  const renderedLines = createMemo(() => {
    const parsed = parseMarkdownTable(props.lines)
    if (!parsed) {
      return props.lines
    }
    return renderBoxTable(parsed)
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
