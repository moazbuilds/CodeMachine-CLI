/** @jsxImportSource @opentui/solid */
/**
 * Prompt Input Component
 *
 * Reusable input field for entering prompts.
 * Used by PauseModal, ChainedModal, etc.
 */

import type { Setter } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface PromptInputProps {
  value: string
  onInput: Setter<string>
  onSubmit: () => void
  placeholder?: string
}

export function PromptInput(props: PromptInputProps) {
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
        placeholder={props.placeholder ?? "Type prompt..."}
        onInput={props.onInput}
        onKeyDown={handleKeyDown}
        focused={true}
        backgroundColor={themeCtx.theme.backgroundElement}
        focusedBackgroundColor={themeCtx.theme.backgroundElement}
      />
    </box>
  )
}
