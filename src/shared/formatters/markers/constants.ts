/**
 * Marker Constants
 *
 * Color markers, attribute markers, symbols, and box drawing characters.
 */

import type { MarkerColor } from './types.js';

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
export const VALID_COLORS = new Set(['gray', 'green', 'red', 'orange', 'cyan', 'magenta', 'blue', 'yellow'])
export const VALID_ATTRIBUTES = new Set(['bold', 'dim', 'italic', 'underline', 'inverse', 'strikethrough'])

// Status to color mapping (for backwards compatibility)
export const STATUS_TO_COLOR: Record<string, Lowercase<MarkerColor>> = {
  THINKING: 'orange',
  SUCCESS: 'green',
  ERROR: 'red',
  RUNNING: 'gray',
  WARNING: 'yellow',
  INFO: 'cyan',
}

// Indentation for nested output (tab-like spacing)
export const INDENT = '   '
