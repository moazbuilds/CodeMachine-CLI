/** @jsxImportSource @opentui/solid */
/**
 * Chained Prompt Box Component
 *
 * Inline prompt box shown below the output window when chaining is active.
 * Supports two-level focus: visible (highlighted) and focused (input active).
 */

import { createSignal, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"

export interface ChainedPromptBoxProps {
  isVisible: boolean
  isFocused: boolean
  currentIndex: number
  totalPrompts: number
  nextPromptLabel: string | null
  onCustomPrompt: (prompt: string) => void
  onNextStep: () => void
  onSkipAll: () => void
  onFocusExit: () => void
}

export function ChainedPromptBox(props: ChainedPromptBoxProps) {
  const themeCtx = useTheme()
  const [input, setInput] = createSignal("")

  useKeyboard((evt) => {
    if (!props.isFocused) return

    if (evt.name === "escape" || evt.name === "left") {
      evt.preventDefault()
      props.onFocusExit()
      return
    }
    if (evt.name === "n" && !input()) {
      evt.preventDefault()
      props.onNextStep()
      return
    }
  })

  const handleSubmit = () => {
    const value = input().trim()
    if (value) {
      props.onCustomPrompt(value)
      setInput("")
    }
  }

  const handleKeyDown = (evt: { name?: string }) => {
    if (evt.name === "return") {
      handleSubmit()
    }
  }

  const hasMorePrompts = () => props.currentIndex < props.totalPrompts

  return (
    <Show when={props.isVisible}>
      <box flexDirection="column" flexShrink={0}>
        {/* Unfocused state - simple hint line */}
        <Show when={!props.isFocused}>
          <box flexDirection="row" paddingLeft={1} height={1}>
            <text fg={themeCtx.theme.primary}>{"* "}</text>
            <Show
              when={hasMorePrompts()}
              fallback={
                <text fg={themeCtx.theme.textMuted}>
                  Chain complete ({props.totalPrompts}/{props.totalPrompts}) - Press [Right] to continue
                </text>
              }
            >
              <text fg={themeCtx.theme.textMuted}>
                Next: "{props.nextPromptLabel}" ({props.currentIndex + 1}/{props.totalPrompts}) - Press [Right] to enter
              </text>
            </Show>
          </box>
        </Show>

        {/* Focused state - full input box */}
        <Show when={props.isFocused}>
          <box
            flexDirection="column"
            paddingLeft={1}
            paddingRight={1}
            borderStyle="rounded"
            borderColor={themeCtx.theme.primary}
          >
            <box flexDirection="row" justifyContent="space-between">
              <box flexDirection="row">
                <text fg={themeCtx.theme.primary}>{"* "}</text>
                <Show
                  when={hasMorePrompts()}
                  fallback={
                    <text fg={themeCtx.theme.text}>
                      Chain complete ({props.totalPrompts}/{props.totalPrompts})
                    </text>
                  }
                >
                  <text fg={themeCtx.theme.text}>
                    Next: "{props.nextPromptLabel}" ({props.currentIndex + 1}/{props.totalPrompts})
                  </text>
                </Show>
              </box>
              <text fg={themeCtx.theme.textMuted}>[N] Next [Enter] Send [Esc] Back</text>
            </box>
            <box
              backgroundColor={themeCtx.theme.backgroundElement}
              paddingLeft={1}
              paddingRight={1}
              height={1}
            >
              <input
                value={input()}
                placeholder="Type custom prompt..."
                onInput={setInput}
                onKeyDown={handleKeyDown}
                focused={true}
                backgroundColor={themeCtx.theme.backgroundElement}
                focusedBackgroundColor={themeCtx.theme.backgroundElement}
              />
            </box>
          </box>
        </Show>
      </box>
    </Show>
  )
}
