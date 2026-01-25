/**
 * Narrator Script Parser
 *
 * Parses narrator script format:
 *   face|delay: text with {N} delays and [face] changes
 *
 * Examples:
 *   idle|3: Hi, {2} I am ali {1} [thinking] your codemachine explainer
 *   thinking|2: Let me explain how this works...
 */

import type { ScriptLine, TextSegment, NarratorScript } from './types.js'

/**
 * Parse a single line of narrator script
 *
 * Format: face|delay: text
 * - face: initial face expression (e.g., "idle", "thinking")
 * - delay: seconds to wait after line completes
 * - text: content with optional {N} delays and [face] inline changes
 */
export function parseScriptLine(line: string): ScriptLine | null {
  const trimmed = line.trim()

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith('#')) {
    return null
  }

  // Parse format: face|delay: text
  const headerMatch = trimmed.match(/^(\w+)\|(\d+(?:\.\d+)?):(.*)$/)

  let initialFace = 'idle'
  let endDelay = 2
  let textContent: string

  if (headerMatch) {
    initialFace = headerMatch[1]
    endDelay = parseFloat(headerMatch[2])
    textContent = headerMatch[3].trim()
  } else {
    // Fallback: treat entire line as text with defaults
    textContent = trimmed
  }

  const segments = parseTextSegments(textContent)

  return {
    initialFace,
    endDelay,
    segments,
  }
}

/**
 * Parse text content into segments
 *
 * Handles:
 * - {N} - pause for N seconds
 * - [face] - change face expression
 * - regular text
 */
export function parseTextSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let remaining = text

  while (remaining.length > 0) {
    // Look for {N} delay pattern
    const delayMatch = remaining.match(/^\{(\d+(?:\.\d+)?)\}/)
    if (delayMatch) {
      segments.push({
        type: 'delay',
        seconds: parseFloat(delayMatch[1]),
      })
      remaining = remaining.slice(delayMatch[0].length)
      continue
    }

    // Look for [face] expression change pattern
    const faceMatch = remaining.match(/^\[(\w+)\]/)
    if (faceMatch) {
      segments.push({
        type: 'face',
        expression: faceMatch[1],
      })
      remaining = remaining.slice(faceMatch[0].length)
      continue
    }

    // Find the next special pattern or end of string
    const nextSpecial = remaining.search(/\{|\[/)
    const textEnd = nextSpecial === -1 ? remaining.length : nextSpecial

    if (textEnd > 0) {
      segments.push({
        type: 'text',
        content: remaining.slice(0, textEnd),
      })
      remaining = remaining.slice(textEnd)
    }
  }

  return segments
}

/**
 * Parse a complete narrator script from string content
 */
export function parseScript(content: string): NarratorScript {
  const lines = content.split('\n')
  const parsedLines: ScriptLine[] = []

  for (const line of lines) {
    const parsed = parseScriptLine(line)
    if (parsed) {
      parsedLines.push(parsed)
    }
  }

  return { lines: parsedLines }
}

/**
 * Create a single-line script from text and options
 * Used by the "say" command
 */
export function createSingleLineScript(
  text: string,
  face: string = 'idle',
  delay: number = 2
): NarratorScript {
  return {
    lines: [
      {
        initialFace: face,
        endDelay: delay,
        segments: parseTextSegments(text),
      },
    ],
  }
}
