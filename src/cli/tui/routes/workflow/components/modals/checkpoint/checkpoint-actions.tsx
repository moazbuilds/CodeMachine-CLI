/** @jsxImportSource @opentui/solid */
/**
 * Checkpoint Actions Component
 *
 * Continue/Quit buttons with selection state.
 */

import { useTheme } from "@tui/shared/context/theme"

export type CheckpointButtonType = "continue" | "quit"

export interface CheckpointActionsProps {
  selectedButton: CheckpointButtonType
  onContinue: () => void
  onQuit: () => void
}

export function CheckpointActions(props: CheckpointActionsProps) {
  const themeCtx = useTheme()

  return (
    <box paddingTop={1} gap={4} flexDirection="row">
      <box
        backgroundColor={props.selectedButton === "continue" ? themeCtx.theme.success : undefined}
        paddingLeft={1}
        paddingRight={1}
        onMouseDown={props.onContinue}
      >
        <text
          fg={props.selectedButton === "continue" ? themeCtx.theme.background : themeCtx.theme.success}
          attributes={1}
        >
          {props.selectedButton === "continue" ? "> " : "  "}[C]ontinue
        </text>
      </box>
      <box
        backgroundColor={props.selectedButton === "quit" ? themeCtx.theme.error : undefined}
        paddingLeft={1}
        paddingRight={1}
        onMouseDown={props.onQuit}
      >
        <text fg={props.selectedButton === "quit" ? themeCtx.theme.background : themeCtx.theme.error}>
          {props.selectedButton === "quit" ? "> " : "  "}[Q]uit
        </text>
      </box>
    </box>
  )
}
