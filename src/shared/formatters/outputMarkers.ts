/**
 * Output Formatting Markers for Pro CLI Display
 *
 * A comprehensive formatting system supporting:
 * - Colors: gray, green, red, orange, cyan, magenta, blue, yellow
 * - Attributes: bold, dim, italic, underline, inverse, strikethrough
 * - Semantic formatters for thinking, commands, results, status, etc.
 * - Composable markers that can be combined
 *
 * Marker Format: [COLOR?:ATTR1,ATTR2,...] or [ATTR1,ATTR2,...] or [COLOR]
 * Examples:
 *   [GREEN:BOLD] - Green bold text
 *   [RED:BOLD,UNDERLINE] - Red bold underlined text
 *   [BOLD] - Bold text (default color)
 *   [DIM] - Dimmed text
 *   [CYAN:ITALIC] - Cyan italic text
 */

import chalk, { type ChalkInstance } from 'chalk'

// ============================================================================
// Types
// ============================================================================

export type MarkerColor =
  | 'gray' | 'green' | 'red' | 'orange' | 'cyan' | 'magenta' | 'blue' | 'yellow'
  | 'GRAY' | 'GREEN' | 'RED' | 'ORANGE' | 'CYAN' | 'MAGENTA' | 'BLUE' | 'YELLOW'

export type MarkerAttribute =
  | 'bold' | 'dim' | 'italic' | 'underline' | 'inverse' | 'strikethrough'
  | 'BOLD' | 'DIM' | 'ITALIC' | 'UNDERLINE' | 'INVERSE' | 'STRIKETHROUGH'

export interface ParsedMarker {
  color: Lowercase<MarkerColor> | null
  attributes: Set<Lowercase<MarkerAttribute>>
  text: string
}

// ============================================================================
// Constants
// ============================================================================

// Color markers (uppercase for internal use)
export const COLOR_GRAY = '[GRAY]'
export const COLOR_GREEN = '[GREEN]'
export const COLOR_RED = '[RED]'
export const COLOR_ORANGE = '[ORANGE]'
export const COLOR_CYAN = '[CYAN]'
export const COLOR_MAGENTA = '[MAGENTA]'
export const COLOR_BLUE = '[BLUE]'
export const COLOR_YELLOW = '[YELLOW]'

// Attribute markers
export const ATTR_BOLD = '[BOLD]'
export const ATTR_DIM = '[DIM]'
export const ATTR_ITALIC = '[ITALIC]'
export const ATTR_UNDERLINE = '[UNDERLINE]'
export const ATTR_INVERSE = '[INVERSE]'
export const ATTR_STRIKETHROUGH = '[STRIKETHROUGH]'

// Symbols for visual hierarchy (ASCII-safe, no emojis)
export const SYMBOL_BULLET = '*'           // Main items
export const SYMBOL_NEST = '|'             // Nested/child items
export const SYMBOL_ARROW = '->'           // Flow/direction
export const SYMBOL_CHECK = '+'            // Success
export const SYMBOL_CROSS = 'x'            // Error/failure
export const SYMBOL_WARN = '!'             // Warning
export const SYMBOL_INFO = '>'             // Info
export const SYMBOL_SPINNER = '~'          // Loading (static representation)
export const SYMBOL_CHEVRON = '>'          // Sub-item
export const SYMBOL_DOT = '.'              // Separator
export const SYMBOL_DASH = '-'             // Horizontal line
export const SYMBOL_PIPE = '|'             // Vertical line
export const SYMBOL_CORNER = '`'           // Tree corner
export const SYMBOL_TEE = '|'              // Tree tee
export const SYMBOL_ELLIPSIS = '...'       // Truncation
export const SYMBOL_USER = '>'             // User input
export const SYMBOL_AI = '>'               // AI response
export const SYMBOL_CODE = '$'             // Code/command prompt
export const SYMBOL_FILE = '-'             // File reference
export const SYMBOL_FOLDER = '-'           // Folder reference

// Box drawing for sections (ASCII-safe)
export const BOX_TOP_LEFT = '+'
export const BOX_TOP_RIGHT = '+'
export const BOX_BOTTOM_LEFT = '+'
export const BOX_BOTTOM_RIGHT = '+'
export const BOX_HORIZONTAL = '-'
export const BOX_VERTICAL = '|'

// Valid colors and attributes for parsing
const VALID_COLORS = new Set(['gray', 'green', 'red', 'orange', 'cyan', 'magenta', 'blue', 'yellow'])
const VALID_ATTRIBUTES = new Set(['bold', 'dim', 'italic', 'underline', 'inverse', 'strikethrough'])

// Status to color mapping (for backwards compatibility)
const STATUS_TO_COLOR: Record<string, Lowercase<MarkerColor>> = {
  THINKING: 'orange',
  SUCCESS: 'green',
  ERROR: 'red',
  RUNNING: 'gray',
  WARNING: 'yellow',
  INFO: 'cyan',
}

// ============================================================================
// Marker Parsing
// ============================================================================

/**
 * Enhanced marker regex that supports:
 * - [COLOR] - just color
 * - [COLOR:ATTR] - color with one attribute
 * - [COLOR:ATTR1,ATTR2] - color with multiple attributes
 * - [ATTR] - just attribute (no color)
 * - [ATTR1,ATTR2] - multiple attributes (no color)
 */
const MARKER_REGEX = /^\[([A-Z]+(?::[A-Z,]+)?|[A-Z,]+)\]/

// Legacy status marker for backwards compatibility
const STATUS_MARKER_REGEX = /^\[(THINKING|SUCCESS|ERROR|RUNNING|WARNING|INFO)\]/

/**
 * Parse a marker string into components
 */
export function parseMarker(text: string): ParsedMarker {
  const result: ParsedMarker = {
    color: null,
    attributes: new Set(),
    text: text
  }

  // Try enhanced marker format first
  const match = text.match(MARKER_REGEX)
  if (match) {
    const markerContent = match[1].toLowerCase()
    const textWithoutMarker = text.slice(match[0].length)

    // Check if it contains a colon (color:attributes format)
    if (markerContent.includes(':')) {
      const [colorPart, attrPart] = markerContent.split(':')
      if (VALID_COLORS.has(colorPart)) {
        result.color = colorPart as Lowercase<MarkerColor>
      }
      // Parse attributes
      const attrs = attrPart.split(',')
      for (const attr of attrs) {
        if (VALID_ATTRIBUTES.has(attr)) {
          result.attributes.add(attr as Lowercase<MarkerAttribute>)
        }
      }
    } else {
      // Single token - could be color OR attribute
      if (VALID_COLORS.has(markerContent)) {
        result.color = markerContent as Lowercase<MarkerColor>
      } else if (VALID_ATTRIBUTES.has(markerContent)) {
        result.attributes.add(markerContent as Lowercase<MarkerAttribute>)
      } else {
        // Could be comma-separated attributes
        const parts = markerContent.split(',')
        for (const part of parts) {
          if (VALID_ATTRIBUTES.has(part)) {
            result.attributes.add(part as Lowercase<MarkerAttribute>)
          }
        }
      }
    }

    result.text = textWithoutMarker
    return result
  }

  // Try legacy status marker
  const statusMatch = text.match(STATUS_MARKER_REGEX)
  if (statusMatch) {
    const status = statusMatch[1]
    result.color = STATUS_TO_COLOR[status] ?? null
    result.text = text.slice(statusMatch[0].length)
    return result
  }

  // Check for legacy bold marker (===)
  if (text.startsWith('===')) {
    result.attributes.add('bold')
    result.text = text.slice(3)
  }

  return result
}

/**
 * Strip all markers from text (for plain text output)
 */
export function stripMarker(text: string): string {
  let result = text

  // Strip enhanced markers
  result = result.replace(MARKER_REGEX, '')

  // Strip legacy status markers
  result = result.replace(STATUS_MARKER_REGEX, '')

  // Strip legacy bold markers
  if (result.startsWith('===')) {
    result = result.slice(3)
  }

  return result
}

// ============================================================================
// Marker Building
// ============================================================================

/**
 * Build a marker string from color and attributes
 */
export function buildMarker(
  color?: MarkerColor | null,
  ...attributes: MarkerAttribute[]
): string {
  const colorUpper = color?.toUpperCase()
  const attrsUpper = attributes.map(a => a.toUpperCase()).join(',')

  if (colorUpper && attrsUpper) {
    return `[${colorUpper}:${attrsUpper}]`
  } else if (colorUpper) {
    return `[${colorUpper}]`
  } else if (attrsUpper) {
    return `[${attrsUpper}]`
  }
  return ''
}

/**
 * Add a marker to text
 */
export function addMarker(
  color: MarkerColor | null,
  text: string,
  ...attributes: MarkerAttribute[]
): string {
  const marker = buildMarker(color, ...attributes)
  return marker + text
}

/**
 * Shorthand for common marker combinations
 */
export const m = {
  // Colors only
  gray: (text: string) => addMarker('GRAY', text),
  green: (text: string) => addMarker('GREEN', text),
  red: (text: string) => addMarker('RED', text),
  orange: (text: string) => addMarker('ORANGE', text),
  cyan: (text: string) => addMarker('CYAN', text),
  magenta: (text: string) => addMarker('MAGENTA', text),
  blue: (text: string) => addMarker('BLUE', text),
  yellow: (text: string) => addMarker('YELLOW', text),

  // Attributes only
  bold: (text: string) => addMarker(null, text, 'BOLD'),
  dim: (text: string) => addMarker(null, text, 'DIM'),
  italic: (text: string) => addMarker(null, text, 'ITALIC'),
  underline: (text: string) => addMarker(null, text, 'UNDERLINE'),
  inverse: (text: string) => addMarker(null, text, 'INVERSE'),
  strike: (text: string) => addMarker(null, text, 'STRIKETHROUGH'),

  // Common combinations
  success: (text: string) => addMarker('GREEN', text, 'BOLD'),
  error: (text: string) => addMarker('RED', text, 'BOLD'),
  warning: (text: string) => addMarker('YELLOW', text, 'BOLD'),
  info: (text: string) => addMarker('CYAN', text),
  muted: (text: string) => addMarker('GRAY', text, 'DIM'),
  highlight: (text: string) => addMarker('CYAN', text, 'BOLD'),
  code: (text: string) => addMarker('MAGENTA', text),
  path: (text: string) => addMarker('BLUE', text, 'UNDERLINE'),
  label: (text: string) => addMarker(null, text, 'BOLD', 'DIM'),
}

// ============================================================================
// Semantic Formatters
// ============================================================================

// Indentation for nested output (tab-like spacing)
const INDENT = '   '

/**
 * Strip markdown bold markers (**text**) from text
 * Returns clean text without the ** markers
 */
export function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1')
}

/**
 * Format thinking output (AI reasoning)
 * Strips markdown bold since we apply italic styling to the whole line
 * Indented as nested under agent
 */
export function formatThinking(text: string): string {
  const cleanText = stripMarkdownBold(text)
  return addMarker('ORANGE', `${INDENT}${SYMBOL_AI} Thinking: ${cleanText}`, 'ITALIC')
}

/**
 * Format command/tool execution with dynamic state
 * Indented as nested under agent
 */
export function formatCommand(
  command: string,
  state: 'started' | 'running' | 'success' | 'error' = 'started'
): string {
  switch (state) {
    case 'error':
      return addMarker('RED', `${INDENT}${SYMBOL_CROSS} ${command}`, 'BOLD')
    case 'success':
      return addMarker('GREEN', `${INDENT}${SYMBOL_CHECK} ${command}`, 'BOLD')
    case 'running':
      return addMarker('CYAN', `${INDENT}${SYMBOL_SPINNER} ${command}`)
    default:
      return addMarker('GRAY', `${INDENT}${SYMBOL_BULLET} Command: ${command}`)
  }
}

/**
 * Format tool name with consistent styling
 */
export function formatTool(name: string, state?: 'active' | 'done' | 'error'): string {
  switch (state) {
    case 'error':
      return addMarker('RED', name, 'BOLD')
    case 'done':
      return addMarker('GREEN', name)
    case 'active':
      return addMarker('CYAN', name, 'BOLD')
    default:
      return addMarker('MAGENTA', name)
  }
}

/**
 * Format nested result output (tool output, code blocks, etc.)
 * Double indented as nested under command
 */
export function formatResult(result: string, isError: boolean = false): string {
  const color = isError ? 'RED' : 'GREEN'
  const lines = result.split('\n')
  const formattedLines = lines.map((line) => {
    if (!line) {
      return addMarker(color, `${INDENT}${INDENT}${SYMBOL_PIPE}`, 'DIM')
    }
    return addMarker(color, `${INDENT}${INDENT}${SYMBOL_PIPE} ${line}`, 'DIM')
  })
  return formattedLines.join('\n')
}

/**
 * Format a code block or snippet
 */
export function formatCode(code: string, language?: string): string {
  const header = language
    ? addMarker('MAGENTA', `${SYMBOL_CODE} ${language}`, 'BOLD', 'DIM')
    : addMarker('MAGENTA', SYMBOL_CODE, 'BOLD', 'DIM')

  const lines = code.split('\n')
  const formattedLines = lines.map(line =>
    addMarker('GRAY', `${SYMBOL_PIPE} ${line}`)
  )

  return [header, ...formattedLines].join('\n')
}

/**
 * Format a file path
 */
export function formatPath(filePath: string): string {
  return addMarker('BLUE', filePath, 'UNDERLINE')
}

/**
 * Format a file reference with optional line number
 */
export function formatFileRef(filePath: string, line?: number): string {
  const pathStr = line ? `${filePath}:${line}` : filePath
  return addMarker('BLUE', `${SYMBOL_FILE} ${pathStr}`, 'UNDERLINE')
}

/**
 * Format status/info message
 * Indented as nested under agent
 */
export function formatStatus(text: string): string {
  return addMarker('CYAN', `${INDENT}${SYMBOL_INFO} ${text}`)
}

/**
 * Format a success message
 */
export function formatSuccess(text: string): string {
  return addMarker('GREEN', `${SYMBOL_CHECK} ${text}`, 'BOLD')
}

/**
 * Format an error message
 */
export function formatError(text: string): string {
  return addMarker('RED', `${SYMBOL_CROSS} ${text}`, 'BOLD')
}

/**
 * Format a warning message
 */
export function formatWarning(text: string): string {
  return addMarker('YELLOW', `${SYMBOL_WARN} ${text}`, 'BOLD')
}

/**
 * Format user input
 */
export function formatUserInput(text: string): string {
  return addMarker('MAGENTA', `${SYMBOL_USER} ${text}`, 'BOLD')
}

/**
 * Format controller agent output header (distinct visual style)
 */
export function formatControllerHeader(agentName?: string): string {
  const name = agentName ?? 'Controller'
  return addMarker('BLUE', `┌── ${name} ${'─'.repeat(30)}`, 'BOLD')
}

/**
 * Format controller agent output footer
 */
export function formatControllerFooter(): string {
  return addMarker('BLUE', `└${'─'.repeat(40)}`, 'BOLD')
}

/**
 * Format controller agent output line (uses BLUE for distinct styling)
 */
export function formatControllerOutput(text: string): string {
  return addMarker('BLUE', text)
}

/**
 * Format AI response header
 */
export function formatAIResponse(agentName?: string): string {
  const name = agentName ?? 'Assistant'
  return addMarker('CYAN', `${SYMBOL_AI} ${name}`, 'BOLD')
}

/**
 * Format a label (key-value style)
 */
export function formatLabel(label: string, value: string): string {
  return `${addMarker('GRAY', label, 'DIM')}: ${addMarker(null, value, 'BOLD')}`
}

/**
 * Format a key-value pair inline
 */
export function formatKV(key: string, value: string | number, color?: MarkerColor): string {
  const valueStr = String(value)
  return `${addMarker('GRAY', key, 'DIM')} ${addMarker(color ?? null, valueStr)}`
}

/**
 * Format a list item
 */
export function formatListItem(text: string, level: number = 0): string {
  const indent = '  '.repeat(level)
  const bullet = level === 0 ? SYMBOL_BULLET : SYMBOL_CHEVRON
  return `${indent}${addMarker('GRAY', bullet)} ${text}`
}

/**
 * Format a tree item
 */
export function formatTreeItem(text: string, isLast: boolean = false, depth: number = 0): string {
  const prefix = isLast ? SYMBOL_CORNER : SYMBOL_TEE
  const indent = `${SYMBOL_PIPE}  `.repeat(depth)
  return `${indent}${addMarker('GRAY', prefix, 'DIM')} ${text}`
}

/**
 * Format a section header
 */
export function formatSection(title: string): string {
  return addMarker(null, `${BOX_HORIZONTAL.repeat(2)} ${title} ${BOX_HORIZONTAL.repeat(20)}`, 'BOLD', 'DIM')
}

/**
 * Format a divider line
 */
export function formatDivider(width: number = 40): string {
  return addMarker('GRAY', BOX_HORIZONTAL.repeat(width), 'DIM')
}

/**
 * Format progress indicator
 */
export function formatProgress(current: number, total: number, label?: string): string {
  const pct = Math.round((current / total) * 100)
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5))
  const text = label ? `${label} ` : ''
  return `${addMarker('CYAN', text)}${addMarker('GREEN', bar)} ${addMarker('GRAY', `${pct}%`, 'DIM')}`
}

/**
 * Format a timestamp
 */
export function formatTimestamp(date?: Date): string {
  const d = date ?? new Date()
  const time = d.toLocaleTimeString('en-US', { hour12: false })
  return addMarker('GRAY', time, 'DIM')
}

/**
 * Format duration (e.g., "2.5s", "1m 30s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return addMarker('GRAY', `${ms}ms`, 'DIM')
  } else if (ms < 60000) {
    return addMarker('GRAY', `${(ms / 1000).toFixed(1)}s`, 'DIM')
  } else {
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    return addMarker('GRAY', `${mins}m ${secs}s`, 'DIM')
  }
}

/**
 * Format token count
 */
export function formatTokens(tokensIn: number, tokensOut: number, cached?: number): string {
  const inStr = tokensIn.toLocaleString()
  const outStr = tokensOut.toLocaleString()
  let result = `${addMarker('CYAN', inStr)}${addMarker('GRAY', 'in', 'DIM')}/${addMarker('GREEN', outStr)}${addMarker('GRAY', 'out', 'DIM')}`
  if (cached && cached > 0) {
    result += ` ${addMarker('GRAY', `(${cached.toLocaleString()} cached)`, 'DIM')}`
  }
  return result
}

/**
 * Format cost
 */
export function formatCost(cost: number): string {
  return addMarker('YELLOW', `$${cost.toFixed(4)}`)
}

/**
 * Format a badge/tag
 */
export function formatBadge(text: string, color: MarkerColor = 'CYAN'): string {
  return addMarker(color, `[${text}]`, 'BOLD')
}

/**
 * Format agent status
 */
export function formatAgentStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'running':
      return addMarker('CYAN', `${SYMBOL_SPINNER} Running`, 'BOLD')
    case 'completed':
      return addMarker('GREEN', `${SYMBOL_CHECK} Completed`, 'BOLD')
    case 'failed':
      return addMarker('RED', `${SYMBOL_CROSS} Failed`, 'BOLD')
    case 'pending':
      return addMarker('GRAY', `${SYMBOL_DOT} Pending`, 'DIM')
    case 'paused':
      return addMarker('YELLOW', `${SYMBOL_WARN} Paused`, 'BOLD')
    case 'skipped':
      return addMarker('GRAY', `${SYMBOL_DASH} Skipped`, 'DIM', 'ITALIC')
    default:
      return addMarker('GRAY', status)
  }
}

/**
 * Format message (generic)
 * Strips markdown formatting for clean display
 */
export function formatMessage(text: string): string {
  const cleanText = stripMarkdownBold(text)
  return addMarker('GRAY', `${SYMBOL_BULLET} ${cleanText}`)
}

/**
 * Format MCP tool call (signals)
 * Uses YELLOW with INVERSE for a distinctive "shining" signal look
 */
export function formatMcpCall(
  server: string,
  tool: string,
  state: 'started' | 'completed' | 'error' = 'started'
): string {
  const signalName = `${server}:${tool}`

  switch (state) {
    case 'error':
      return addMarker('RED', `${INDENT}<< SIGNAL >> ${signalName}`, 'BOLD', 'INVERSE')
    case 'completed':
      return addMarker('GREEN', `${INDENT}<< SIGNAL >> ${signalName}`, 'BOLD')
    default:
      // Started - shining yellow inverse for maximum visibility
      return addMarker('YELLOW', `${INDENT}>> SIGNAL >> ${signalName}`, 'BOLD', 'INVERSE')
  }
}

/**
 * Format MCP tool result (signal response)
 * Shows the result content with special signal styling
 */
export function formatMcpResult(result: string, isError: boolean = false): string {
  const color = isError ? 'RED' : 'YELLOW'
  const lines = result.split('\n')
  const formattedLines = lines.map((line) => {
    if (!line) {
      return addMarker(color, `${INDENT}${INDENT}${SYMBOL_PIPE}`, 'DIM')
    }
    return addMarker(color, `${INDENT}${INDENT}${SYMBOL_PIPE} ${line}`, 'DIM')
  })
  return formattedLines.join('\n')
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + SYMBOL_ELLIPSIS
}

/**
 * Pad text to width
 */
export function pad(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const stripped = stripMarker(text)
  const padding = width - stripped.length
  if (padding <= 0) return text

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text
    case 'center': {
      const left = Math.floor(padding / 2)
      const right = padding - left
      return ' '.repeat(left) + text + ' '.repeat(right)
    }
    default:
      return text + ' '.repeat(padding)
  }
}

/**
 * Indent text by level
 */
export function indent(text: string, level: number = 1, char: string = '  '): string {
  const prefix = char.repeat(level)
  return text.split('\n').map(line => prefix + line).join('\n')
}

/**
 * Wrap text to width, preserving markers
 */
export function wrap(text: string, width: number): string[] {
  const { color, attributes, text: content } = parseMarker(text)
  const words = content.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > width) {
      if (currentLine) {
        lines.push(addMarker(color, currentLine.trim(), ...Array.from(attributes) as MarkerAttribute[]))
      }
      currentLine = word
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word
    }
  }

  if (currentLine) {
    lines.push(addMarker(color, currentLine.trim(), ...Array.from(attributes) as MarkerAttribute[]))
  }

  return lines
}

// ============================================================================
// Chalk Rendering (for direct console output)
// ============================================================================

/**
 * Map color names to chalk methods
 */
function getChalkColor(color: Lowercase<MarkerColor> | null): ChalkInstance {
  switch (color) {
    case 'gray': return chalk.gray
    case 'green': return chalk.green
    case 'red': return chalk.red
    case 'orange': return chalk.hex('#FFA500')
    case 'yellow': return chalk.yellow
    case 'cyan': return chalk.cyan
    case 'magenta': return chalk.magenta
    case 'blue': return chalk.blue
    default: return chalk
  }
}

/**
 * Apply chalk attributes to a chalk instance
 */
function applyChalkAttributes(chalkInstance: ChalkInstance, attributes: Set<Lowercase<MarkerAttribute>>): ChalkInstance {
  let result = chalkInstance
  for (const attr of attributes) {
    switch (attr) {
      case 'bold': result = result.bold; break
      case 'dim': result = result.dim; break
      case 'italic': result = result.italic; break
      case 'underline': result = result.underline; break
      case 'inverse': result = result.inverse; break
      case 'strikethrough': result = result.strikethrough; break
    }
  }
  return result
}

/**
 * Render a single line with markers to chalk-colored output
 */
function renderLineToChalk(line: string): string {
  const parsed = parseMarker(line)

  if (!parsed.color && parsed.attributes.size === 0) {
    // No formatting, return as-is
    return parsed.text
  }

  let chalkInstance = getChalkColor(parsed.color)
  chalkInstance = applyChalkAttributes(chalkInstance, parsed.attributes)

  return chalkInstance(parsed.text)
}

/**
 * Render text with markers to chalk-colored output for direct console display.
 * Processes each line and converts markers like [CYAN], [GRAY:BOLD] to actual colors.
 *
 * @example
 * const output = formatStatus('Loading...')  // Returns "[CYAN]> Loading..."
 * console.log(renderToChalk(output))         // Prints in actual cyan color
 */
export function renderToChalk(text: string): string {
  // Process each line separately to handle multi-line output
  const lines = text.split('\n')
  const renderedLines = lines.map(line => renderLineToChalk(line))
  return renderedLines.join('\n')
}
