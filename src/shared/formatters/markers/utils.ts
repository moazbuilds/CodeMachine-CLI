/**
 * Marker Utilities
 *
 * Utility functions for text manipulation with marker support.
 */

import type { MarkerAttribute } from './types.js';
import { SYMBOL_ELLIPSIS } from './constants.js';
import { parseMarker, stripMarker } from './parser.js';
import { addMarker } from './builder.js';

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
    case 'center':
      const left = Math.floor(padding / 2)
      const right = padding - left
      return ' '.repeat(left) + text + ' '.repeat(right)
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
