/** @jsxImportSource @opentui/solid */
/**
 * Project Name Step Component
 */

import type { ProjectNameStepProps } from "./types"

export function ProjectNameStep(props: ProjectNameStepProps) {
  return (
    <box flexDirection="row" gap={1}>
      <text fg={props.theme.primary}>{">"}</text>
      <box
        backgroundColor={props.theme.backgroundElement}
        paddingLeft={1}
        paddingRight={1}
        minWidth={30}
      >
        <text fg={props.theme.text}>
          {props.projectName}{props.typingDone ? "_" : ""}
        </text>
      </box>
    </box>
  )
}
