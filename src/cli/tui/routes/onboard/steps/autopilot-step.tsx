/** @jsxImportSource @opentui/solid */
/**
 * Autopilot Selection Step Component
 */

import { For } from "solid-js"
import type { AutopilotStepProps } from "./types"

export function AutopilotStep(props: AutopilotStepProps) {
  return (
    <For each={props.autopilots}>
      {([autopilotId, agent], index) => {
        const isSelected = () => index() === props.selectedIndex
        return (
          <box flexDirection="column">
            <box flexDirection="row" gap={1}>
              <text fg={isSelected() ? props.theme.primary : props.theme.textMuted}>
                {isSelected() ? ">" : " "}
              </text>
              <text fg={isSelected() ? props.theme.primary : props.theme.textMuted}>
                {isSelected() ? "(*)" : "( )"}
              </text>
              <text fg={isSelected() ? props.theme.primary : props.theme.text}>
                {autopilotId}
              </text>
            </box>
          </box>
        )
      }}
    </For>
  )
}
