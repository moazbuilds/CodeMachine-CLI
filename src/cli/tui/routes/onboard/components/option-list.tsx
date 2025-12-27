/** @jsxImportSource @opentui/solid */
/**
 * Option List Component
 *
 * Generic selectable list with radio or checkbox styling.
 */

import { For } from "solid-js"
import type { Accessor } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface OptionItem {
  id: string
  label: string
  description?: string
}

export interface OptionListProps {
  /** List of options to display */
  options: OptionItem[]
  /** Currently selected index */
  selectedIndex: Accessor<number>
  /** Whether this is a multi-select list */
  multiSelect?: boolean
  /** Check if an option is checked (for multi-select) */
  isChecked?: (id: string) => boolean
}

export function OptionList(props: OptionListProps) {
  const themeCtx = useTheme()

  return (
    <For each={props.options}>
      {(option, index) => {
        const isSelected = () => index() === props.selectedIndex()
        const isChecked = () => props.isChecked?.(option.id) ?? false
        const multiSelect = props.multiSelect ?? false

        return (
          <box flexDirection="column">
            <box flexDirection="row" gap={1}>
              <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                {isSelected() ? ">" : " "}
              </text>
              <text
                fg={
                  multiSelect
                    ? isChecked()
                      ? themeCtx.theme.primary
                      : themeCtx.theme.textMuted
                    : isSelected()
                      ? themeCtx.theme.primary
                      : themeCtx.theme.textMuted
                }
              >
                {multiSelect
                  ? isChecked()
                    ? "[x]"
                    : "[ ]"
                  : isSelected()
                    ? "(*)"
                    : "( )"}
              </text>
              <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.text}>
                {option.label}
              </text>
            </box>
            {option.description && (
              <box marginLeft={6}>
                <text fg={themeCtx.theme.textMuted}>{option.description}</text>
              </box>
            )}
          </box>
        )
      }}
    </For>
  )
}
