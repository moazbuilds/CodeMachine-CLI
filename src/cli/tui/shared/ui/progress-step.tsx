/** @jsxImportSource @opentui/solid */
/**
 * ProgressStep Component
 *
 * Displays a single step in a progress list with status indicator.
 */

import { useTheme } from "@tui/shared/context/theme"

export type StepStatus = "pending" | "active" | "done" | "error"

export interface ProgressStepProps {
  label: string
  status: StepStatus
}

export function ProgressStep(props: ProgressStepProps) {
  const theme = useTheme()

  const icon = () => {
    switch (props.status) {
      case "done":
        return "✓"
      case "active":
        return "●"
      case "error":
        return "✗"
      default:
        return " "
    }
  }

  const color = () => {
    switch (props.status) {
      case "done":
        return theme.theme.success
      case "active":
        return theme.theme.primary
      case "error":
        return theme.theme.error
      default:
        return theme.theme.textMuted
    }
  }

  const textColor = () => {
    return props.status === "pending" ? theme.theme.textMuted : theme.theme.text
  }

  return (
    <box flexDirection="row">
      <text fg={color()}>[{icon()}]</text>
      <text fg={textColor()}> {props.label}</text>
    </box>
  )
}
