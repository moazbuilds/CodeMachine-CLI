/**
 * Markdown Table Parser and Box-Drawing Renderer
 *
 * Parses markdown tables and renders them with Unicode box-drawing characters.
 * Supports column alignment detection from separator rows.
 */

// Box-drawing characters for table rendering
const BOX = {
  // Corners
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  // T-junctions
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  // Cross
  cross: '┼',
  // Lines
  horizontal: '─',
  vertical: '│',
} as const

export type ColumnAlignment = 'left' | 'center' | 'right'

export interface ParsedTable {
  headers: string[]
  alignments: ColumnAlignment[]
  rows: string[][]
  columnWidths: number[]
}

/**
 * Check if a line is part of a markdown table
 */
export function isTableLine(line: string): boolean {
  const trimmed = line.trim()
  // Table lines start and end with | or contain | separators
  return trimmed.startsWith('|') && trimmed.endsWith('|')
}

/**
 * Check if a line is a table separator row (e.g., |---|---|)
 */
export function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false

  // Extract cells and check if all are separator patterns
  const cells = trimmed.slice(1, -1).split('|')
  return cells.every(cell => {
    const c = cell.trim()
    // Match patterns like ---, :---, ---:, :---:
    return /^:?-+:?$/.test(c)
  })
}

/**
 * Parse column alignment from separator row
 */
function parseAlignment(separator: string): ColumnAlignment {
  const s = separator.trim()
  const hasLeftColon = s.startsWith(':')
  const hasRightColon = s.endsWith(':')

  if (hasLeftColon && hasRightColon) return 'center'
  if (hasRightColon) return 'right'
  return 'left'
}

/**
 * Parse a table row into cells
 */
function parseRow(line: string): string[] {
  const trimmed = line.trim()
  // Remove leading and trailing |
  const inner = trimmed.slice(1, -1)
  return inner.split('|').map(cell => cell.trim())
}

/**
 * Parse markdown table lines into structured data
 */
export function parseMarkdownTable(lines: string[]): ParsedTable | null {
  if (lines.length < 2) return null

  // Find separator row (usually line 1, but be flexible)
  let separatorIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (isSeparatorRow(lines[i])) {
      separatorIndex = i
      break
    }
  }

  if (separatorIndex === -1 || separatorIndex === 0) {
    // No separator found or no header - treat as simple table without header
    const rows = lines.filter(l => isTableLine(l) && !isSeparatorRow(l)).map(parseRow)
    if (rows.length === 0) return null

    const columnCount = Math.max(...rows.map(r => r.length))
    const columnWidths = calculateColumnWidths([], rows, columnCount)

    return {
      headers: [],
      alignments: new Array(columnCount).fill('left'),
      rows,
      columnWidths,
    }
  }

  // Parse header (lines before separator)
  const headerLines = lines.slice(0, separatorIndex)
  const headers = headerLines.length > 0 ? parseRow(headerLines[0]) : []

  // Parse alignments from separator
  const separatorCells = parseRow(lines[separatorIndex])
  const alignments = separatorCells.map(parseAlignment)

  // Parse data rows (lines after separator)
  const dataLines = lines.slice(separatorIndex + 1)
  const rows = dataLines.filter(l => isTableLine(l) && !isSeparatorRow(l)).map(parseRow)

  // Calculate column count and widths
  const columnCount = Math.max(headers.length, ...rows.map(r => r.length), alignments.length)
  const columnWidths = calculateColumnWidths(headers, rows, columnCount)

  // Normalize alignments array length
  while (alignments.length < columnCount) {
    alignments.push('left')
  }

  return {
    headers,
    alignments,
    rows,
    columnWidths,
  }
}

/**
 * Calculate the width needed for each column
 */
function calculateColumnWidths(headers: string[], rows: string[][], columnCount: number): number[] {
  const widths: number[] = new Array(columnCount).fill(0)

  // Check header widths
  headers.forEach((h, i) => {
    widths[i] = Math.max(widths[i], h.length)
  })

  // Check row widths
  rows.forEach(row => {
    row.forEach((cell, i) => {
      if (i < columnCount) {
        widths[i] = Math.max(widths[i], cell.length)
      }
    })
  })

  // Minimum width of 3 for aesthetics
  return widths.map(w => Math.max(w, 3))
}

/**
 * Pad a string according to alignment
 */
function padCell(text: string, width: number, align: ColumnAlignment): string {
  const padding = width - text.length
  if (padding <= 0) return text.slice(0, width)

  switch (align) {
    case 'center': {
      const left = Math.floor(padding / 2)
      const right = padding - left
      return ' '.repeat(left) + text + ' '.repeat(right)
    }
    case 'right':
      return ' '.repeat(padding) + text
    case 'left':
    default:
      return text + ' '.repeat(padding)
  }
}

/**
 * Render a horizontal line (top, middle, or bottom)
 */
function renderHorizontalLine(
  widths: number[],
  left: string,
  middle: string,
  right: string,
  line: string
): string {
  const segments = widths.map(w => line.repeat(w + 2)) // +2 for cell padding
  return left + segments.join(middle) + right
}

/**
 * Render a data row with cell content
 */
function renderDataRow(
  cells: string[],
  widths: number[],
  alignments: ColumnAlignment[]
): string {
  const paddedCells = widths.map((width, i) => {
    const cell = cells[i] || ''
    const align = alignments[i] || 'left'
    return ' ' + padCell(cell, width, align) + ' '
  })
  return BOX.vertical + paddedCells.join(BOX.vertical) + BOX.vertical
}

/**
 * Render a parsed table as box-drawing strings
 */
export function renderBoxTable(table: ParsedTable): string[] {
  const { headers, alignments, rows, columnWidths } = table
  const lines: string[] = []

  // Top border
  lines.push(renderHorizontalLine(
    columnWidths,
    BOX.topLeft,
    BOX.topT,
    BOX.topRight,
    BOX.horizontal
  ))

  // Header row (if present)
  if (headers.length > 0) {
    lines.push(renderDataRow(headers, columnWidths, alignments))
    // Header separator
    lines.push(renderHorizontalLine(
      columnWidths,
      BOX.leftT,
      BOX.cross,
      BOX.rightT,
      BOX.horizontal
    ))
  }

  // Data rows
  rows.forEach((row, index) => {
    lines.push(renderDataRow(row, columnWidths, alignments))
    // Add separator between rows (except after last row)
    if (index < rows.length - 1) {
      lines.push(renderHorizontalLine(
        columnWidths,
        BOX.leftT,
        BOX.cross,
        BOX.rightT,
        BOX.horizontal
      ))
    }
  })

  // Bottom border
  lines.push(renderHorizontalLine(
    columnWidths,
    BOX.bottomLeft,
    BOX.bottomT,
    BOX.bottomRight,
    BOX.horizontal
  ))

  return lines
}

/**
 * Group consecutive lines into table groups and regular lines
 */
export interface LineGroup {
  type: 'table' | 'line'
  lines: string[]
}

export function groupLinesWithTables(lines: string[]): LineGroup[] {
  const groups: LineGroup[] = []
  let currentTableLines: string[] = []

  for (const line of lines) {
    if (isTableLine(line)) {
      currentTableLines.push(line)
    } else {
      // Flush any accumulated table lines
      if (currentTableLines.length > 0) {
        groups.push({ type: 'table', lines: currentTableLines })
        currentTableLines = []
      }
      // Add regular line
      groups.push({ type: 'line', lines: [line] })
    }
  }

  // Flush remaining table lines
  if (currentTableLines.length > 0) {
    groups.push({ type: 'table', lines: currentTableLines })
  }

  return groups
}

/**
 * Convert markdown table lines directly to box-drawing lines
 * Convenience function that combines parsing and rendering
 */
export function markdownTableToBox(lines: string[]): string[] {
  const parsed = parseMarkdownTable(lines)
  if (!parsed) {
    // If parsing fails, return original lines
    return lines
  }
  return renderBoxTable(parsed)
}
