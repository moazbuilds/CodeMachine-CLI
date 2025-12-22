/**
 * Status Icons and Colors for Agent Display
 * Ported from: src/ui/utils/statusIcons.ts
 */

import type { RGBA } from "@opentui/core"
import type { AgentStatus } from "../../state/types"
import type { Theme } from "@tui/shared/context/theme"

/**
 * Get status icon for agent
 * Matches old implementation exactly
 */
export function getStatusIcon(status: AgentStatus): string {
  switch (status) {
    case "pending":
      return "○" // Empty circle
    case "running":
      return "◐" // Fallback (animated by Spinner component)
    case "completed":
      return "●" // Green filled circle
    case "failed":
      return "✗" // Red X for failed
    case "skipped":
      return "●" // Filled circle
    case "retrying":
      return "⟳" // Retry symbol
    case "awaiting":
      return "◉" // Awaiting user input
    case "paused":
      return "॥" // Paused
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
    case "failed":
      return theme.error // red for failed
    case "skipped":
      return theme.textMuted // gray/muted for skipped
    case "awaiting":
      return theme.warning // yellow for awaiting
    case "paused":
      return theme.warning // yellow for paused
    default:
      return theme.text // white
  }
}
