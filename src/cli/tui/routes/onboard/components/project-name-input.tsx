/** @jsxImportSource @opentui/solid */
/**
 * Project Name Input Component
 *
 * Text input for entering project name.
 */

import type { Accessor } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface ProjectNameInputProps {
  /** Current project name value */
  value: Accessor<string>
  /** Whether typing animation is complete (shows cursor) */
  typingDone: Accessor<boolean>
}

export function ProjectNameInput(props: ProjectNameInputProps) {
  const themeCtx = useTheme()

  return (
    <box flexDirection="row" gap={1}>
      <text fg={themeCtx.theme.primary}>{">"}</text>
      <box
        backgroundColor={themeCtx.theme.backgroundElement}
        paddingLeft={1}
        paddingRight={1}
        minWidth={30}
      >
        <text fg={themeCtx.theme.text}>
          {props.value()}{props.typingDone() ? "_" : ""}
        </text>
      </box>
    </box>
  )
}
