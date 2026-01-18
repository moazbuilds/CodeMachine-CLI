/** @jsxImportSource @opentui/solid */
/**
 * StatusBadge Component
 *
 * Displays a pill-style status indicator for connection states.
 */

import { useTheme } from "@tui/shared/context/theme"

export type BadgeStatus = "connected" | "disconnected" | "pending"

export interface StatusBadgeProps {
  status: BadgeStatus
  compact?: boolean
}

export function StatusBadge(props: StatusBadgeProps) {
  const theme = useTheme()

  const label = () => {
    if (props.compact) {
      switch (props.status) {
        case "connected":
          return "●"
        case "disconnected":
          return "○"
        case "pending":
          return "◌"
      }
    }
    switch (props.status) {
      case "connected":
        return "Connected"
      case "disconnected":
        return "Offline"
      case "pending":
        return "..."
    }
  }

  const color = () => {
    switch (props.status) {
      case "connected":
        return theme.theme.success
      case "disconnected":
        return theme.theme.textMuted
      case "pending":
        return theme.theme.warning
    }
  }

  return (
    <text fg={color()}>
      {props.compact ? label() : `[${label()}]`}
    </text>
  )
}

/**
 * Create a footer element for DialogSelect options showing connection status.
 */
export function createStatusFooter(isConnected: boolean): any {
  return <StatusBadge status={isConnected ? "connected" : "disconnected"} />
}
