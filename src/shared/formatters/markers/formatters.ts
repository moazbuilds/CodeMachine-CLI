/**
 * Semantic Formatters
 *
 * High-level formatting functions for common output patterns.
 */

import type { MarkerColor } from './types.js';
import { addMarker } from './builder.js';
import {
  INDENT,
  SYMBOL_BULLET,
  SYMBOL_CHECK,
  SYMBOL_CROSS,
  SYMBOL_WARN,
  SYMBOL_INFO,
  SYMBOL_SPINNER,
  SYMBOL_CHEVRON,
  SYMBOL_DOT,
  SYMBOL_DASH,
  SYMBOL_PIPE,
  SYMBOL_CORNER,
  SYMBOL_TEE,
  SYMBOL_USER,
  SYMBOL_AI,
  SYMBOL_CODE,
  SYMBOL_FILE,
  BOX_HORIZONTAL,
} from './constants.js';

/**
 * Strip markdown bold markers (**text**) from text
 */
export function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1')
}

/**
 * Format thinking output (AI reasoning)
 */
export function formatThinking(text: string): string {
  const cleanText = stripMarkdownBold(text)
  return addMarker('ORANGE', `${INDENT}${SYMBOL_AI} Thinking: ${cleanText}`, 'ITALIC')
}

/**
 * Format command/tool execution with dynamic state
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
 * Format autopilot agent output header
 */
export function formatAutopilotHeader(agentName?: string): string {
  const name = agentName ?? 'Autopilot'
  return addMarker('BLUE', `┌── ${name} ${'─'.repeat(30)}`, 'BOLD')
}

/**
 * Format autopilot agent output footer
 */
export function formatAutopilotFooter(): string {
  return addMarker('BLUE', `└${'─'.repeat(40)}`, 'BOLD')
}

/**
 * Format autopilot agent output line
 */
export function formatAutopilotOutput(text: string): string {
  return addMarker('BLUE', text)
}

// Legacy aliases for backwards compatibility
/** @deprecated Use formatAutopilotHeader instead */
export const formatControllerHeader = formatAutopilotHeader;
/** @deprecated Use formatAutopilotFooter instead */
export const formatControllerFooter = formatAutopilotFooter;
/** @deprecated Use formatAutopilotOutput instead */
export const formatControllerOutput = formatAutopilotOutput;

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
 */
export function formatMessage(text: string): string {
  const cleanText = stripMarkdownBold(text)
  return addMarker('GRAY', `${SYMBOL_BULLET} ${cleanText}`)
}
