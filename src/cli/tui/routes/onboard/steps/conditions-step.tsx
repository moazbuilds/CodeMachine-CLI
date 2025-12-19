/** @jsxImportSource @opentui/solid */
/**
 * Conditions Selection Step Component
 */

import { For } from "solid-js"
import type { ConditionsStepProps } from "./types"

export function ConditionsStep(props: ConditionsStepProps) {
  return (
    <For each={props.conditions}>
      {([conditionId, config], index) => {
        const isSelected = () => index() === props.selectedIndex
        const isChecked = () => props.selectedConditions.has(conditionId)
        return (
          <box flexDirection="column">
            <box flexDirection="row" gap={1}>
              <text fg={isSelected() ? props.theme.primary : props.theme.textMuted}>
                {isSelected() ? ">" : " "}
              </text>
              <text fg={isChecked() ? props.theme.primary : props.theme.textMuted}>
                {isChecked() ? "[x]" : "[ ]"}
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
