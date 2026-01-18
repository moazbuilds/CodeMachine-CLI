/**
 * Workflow Layout Constants
 *
 * Fixed heights for header, footer, borders, etc.
 */

export const HEADER_HEIGHT = 3  // Branding header
export const FOOTER_HEIGHT = 2  // Telemetry bar + status footer
export const PANEL_BORDER = 2   // Top and bottom border of panel
export const PANEL_CHROME = 2   // Extra buffer for padding

/**
 * Calculate visible items based on terminal height
 */
export function calculateVisibleItems(termHeight: number): number {
  const available = termHeight - HEADER_HEIGHT - FOOTER_HEIGHT - PANEL_BORDER - PANEL_CHROME
  return Math.max(5, available)
}
