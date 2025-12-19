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
 *
 * This file re-exports from the markers/ module for backwards compatibility.
 */

// Re-export everything from the markers module
export * from './markers/index.js';
