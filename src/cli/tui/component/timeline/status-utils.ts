/**
 * Status Icons and Colors for Agent Display
 * Ported from: src/ui/utils/statusIcons.ts
 */

import type { RGBA } from "@opentui/core"
import type { AgentStatus } from "@tui/state/types"
import type { Theme } from "@tui/context/theme"

/**
 * Get status icon for agent
 * Matches old implementation exactly
 */
export function getStatusIcon(status: AgentStatus): string {
  switch (status) {
    case "pending":
      return "○" // Empty circle
    case "running":
      return "⠋" // Spinner (will animate)
    case "completed":
      return "●" // Green filled circle
    case "skipped":
      return "●" // Filled circle
    case "retrying":
      return "⟳" // Retry symbol
    default:
      return "?"
  }
}

/**
 * Get color for status
 * Matches old implementation: green for completed, blue for running, white otherwise
 */
export function getStatusColor(status: AgentStatus, theme: Theme): RGBA {
  switch (status) {
    case "completed":
      return theme.success // green
    case "running":
      return theme.primary // blue
    default:
      return theme.text // white
  }
}
