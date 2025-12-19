/**
 * Marker Types
 *
 * Type definitions for the output formatting marker system.
 */

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
