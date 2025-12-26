/** @jsxImportSource @opentui/solid */
/**
 * Prompt Line Hint
 *
 * Displays contextual hints on the right side of the prompt line.
 * Shows step progress (Step #/#) during chained workflows,
 * or action hints like [Enter] Send.
 */

import { Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import type { PromptLineState } from "./types"

export interface PromptLineHintProps {
  state: PromptLineState
  isInteractive: boolean
}

export function getHintText(state: PromptLineState, isInteractive: boolean): string | null {
  // Show chained step info even in passive mode
  if (state.mode === "passive" && state.chainedStep) {
    const step = state.chainedStep
    return `Step ${step.index}/${step.total}: ${step.name}`
  }

  if (!isInteractive) return null

  if (state.mode === "chained") {
    return `Step ${state.index}/${state.total}: ${state.name}`
  }

  if (state.mode === "active" && state.reason === "paused") {
    return "[Enter] Resume"
  }

  return "[Enter] Send"
}

export function PromptLineHint(props: PromptLineHintProps) {
  const themeCtx = useTheme()

  const hint = () => getHintText(props.state, props.isInteractive)

  return (
    <Show when={hint()}>
      <text fg={themeCtx.theme.textMuted}> {hint()}</text>
    </Show>
  )
}
