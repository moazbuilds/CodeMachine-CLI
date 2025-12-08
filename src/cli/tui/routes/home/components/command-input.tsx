/** @jsxImportSource @opentui/solid */
/**
 * Command Input Component
 *
 * Prompt wrapper for command input in home view.
 */

import { Prompt } from "@tui/shared/components/prompt"

export interface CommandInputProps {
  onSubmit: (command: string) => void
  disabled?: boolean
}

export function CommandInput(props: CommandInputProps) {
  return (
    <Prompt
      onSubmit={props.onSubmit}
      disabled={props.disabled}
    />
  )
}
