/** @jsxImportSource @opentui/solid */
/**
 * Tracks Selection Step Component
 */

import { For } from "solid-js"
import type { TracksStepProps } from "./types"

export function TracksStep(props: TracksStepProps) {
  return (
    <For each={props.tracks}>
      {([trackId, config], index) => {
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
                {config.label}
              </text>
            </box>
            {config.description && (
              <box marginLeft={6}>
                <text fg={props.theme.textMuted}>{config.description}</text>
              </box>
            )}
          </box>
        )
      }}
    </For>
  )
}
