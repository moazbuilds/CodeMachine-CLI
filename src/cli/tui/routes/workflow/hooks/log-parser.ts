/**
 * Log Parser Utilities
 *
 * Filtering and parsing utilities for log display.
 */

/**
 * Filter out box-style header lines and telemetry from log display
 * These are kept in log files for debugging but hidden from UI
 */
export function filterHeaderLines(lines: string[]): string[] {
  const filtered = lines.filter((line) => {
    if (line.includes("╭─") || line.includes("╰─")) return false
    if (line.includes("Started:") || line.includes("Prompt:")) return false
    // Filter out token telemetry lines (shown in telemetry bar instead)
    if (line.includes("Tokens:") && (line.includes("in/") || line.includes("out"))) return false
    return true
  })
  // Trim empty lines from start
  while (filtered.length > 0 && !filtered[0]?.trim()) {
    filtered.shift()
  }
  return filtered
}

/**
 * Extract latest thinking line from logs
 * Looks for lines with "Thinking:" pattern
 */
export function extractLatestThinking(lines: string[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (line && line.includes("Thinking:")) {
      // Extract text after "Thinking:" and strip markers
      const match = line.match(/Thinking:\s*(.+)/)
      if (match) {
        return match[1].trim()
      }
    }
  }
  return null
}
