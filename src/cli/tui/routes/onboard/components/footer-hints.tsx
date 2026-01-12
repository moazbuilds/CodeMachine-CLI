/** @jsxImportSource @opentui/solid */
/**
 * Footer Hints Component
 *
 * Displays keyboard hints based on current step.
 */

import { Show } from "solid-js"
import type { Accessor } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import type { OnboardStep } from "../../../../../workflows/events/types"

export interface FooterHintsProps {
  /** Current onboarding step */
  currentStep: Accessor<OnboardStep>
  /** Whether current step is multi-select */
  isMultiSelect: Accessor<boolean>
}

export function FooterHints(props: FooterHintsProps) {
  const themeCtx = useTheme()

  const isConditionStep = () => {
    const step = props.currentStep()
    return step === 'condition_group' || step === 'condition_child'
  }

  return (
    <box marginTop={2}>
      <Show when={props.currentStep() === 'project_name'}>
        <text fg={themeCtx.theme.textMuted}>
          [Enter] Confirm  [Esc] Cancel
        </text>
      </Show>

      <Show when={props.currentStep() === 'tracks'}>
        <text fg={themeCtx.theme.textMuted}>
          [Up/Down] Navigate  [Enter] Select  [Esc] Cancel
        </text>
      </Show>

      <Show when={isConditionStep() && props.isMultiSelect()}>
        <text fg={themeCtx.theme.textMuted}>
          [Up/Down] Navigate  [Enter] Toggle  [Tab] Confirm  [Esc] Cancel
        </text>
      </Show>

      <Show when={isConditionStep() && !props.isMultiSelect()}>
        <text fg={themeCtx.theme.textMuted}>
          [Up/Down] Navigate  [Enter] Select  [Esc] Cancel
        </text>
      </Show>
    </box>
  )
}
