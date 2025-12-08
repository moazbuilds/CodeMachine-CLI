/** @jsxImportSource @opentui/solid */
/**
 * Pause Input Component
 *
 * Input field for entering resume prompt.
 */

import type { Setter } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface PauseInputProps {
  value: string
  onInput: Setter<string>
  onSubmit: () => void
}

export function PauseInput(props: PauseInputProps) {
  const themeCtx = useTheme()

  const handleKeyDown = (evt: { name?: string }) => {
    if (evt.name === "return") {
      props.onSubmit()
    }
  }

  return (
    <box
      marginTop={1}
      backgroundColor={themeCtx.theme.backgroundElement}
      paddingLeft={1}
      paddingRight={1}
      height={1}
    >
      <input
        value={props.value}
        placeholder="Continue where you left off..."
        onInput={props.onInput}
        onKeyDown={handleKeyDown}
        focused={true}
        backgroundColor={themeCtx.theme.backgroundElement}
        focusedBackgroundColor={themeCtx.theme.backgroundElement}
      />
    </box>
  )
}
