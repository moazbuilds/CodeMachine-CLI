/**
 * Marker Parser
 *
 * Functions for parsing and stripping marker strings.
 */

import type { MarkerColor, MarkerAttribute, ParsedMarker } from './types.js';
import { VALID_COLORS, VALID_ATTRIBUTES, STATUS_TO_COLOR } from './constants.js';

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
