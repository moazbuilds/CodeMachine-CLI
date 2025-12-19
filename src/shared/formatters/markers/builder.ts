/**
 * Marker Builder
 *
 * Functions for building marker strings and shorthand helpers.
 */

import type { MarkerColor, MarkerAttribute } from './types.js';

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
