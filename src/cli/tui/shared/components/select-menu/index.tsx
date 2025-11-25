/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, For } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { SelectMenuProps } from "./types"
import type { ScrollBoxRenderable } from "@opentui/core"

export function SelectMenu<T = string>(props: SelectMenuProps<T>) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [isActive, setIsActive] = createSignal(true)
  let scrollRef: ScrollBoxRenderable | undefined

  // Calculate max height for scrollbox based on terminal size
  const maxHeight = createMemo(() => {
    const dims = dimensions()
    const termHeight = dims?.height ?? 24 // Fallback to 24 if undefined/null

    // Guard against invalid dimensions during resize
    if (!termHeight || termHeight < 15 || !isFinite(termHeight)) {
      return 10 // Safe fallback
    }

    // Each choice takes ~3 lines (bullet + title + description)
    // Reserve space for message (3 lines) + help text (2 lines) + padding (5 lines)
    const availableHeight = termHeight - 10
    // Ensure we always return a valid positive integer (min 5, max terminal height)
    const calculated = Math.max(5, Math.min(Math.floor(availableHeight), termHeight - 5))

    // Final safety check - must be positive integer
    return isFinite(calculated) && calculated > 0 ? calculated : 10
  })

  // Auto-scroll selected item into view (including its full height with description)
  const scrollToSelected = () => {
    if (!scrollRef) return
    const children = scrollRef.getChildren()
    const target = children[selectedIndex()]
    if (!target) return

    // Calculate positions relative to scrollbox
    const itemTop = target.y - scrollRef.y
    const itemBottom = itemTop + target.height

    // Scroll down if bottom of item is below viewport
    if (itemBottom > scrollRef.height) {
      scrollRef.scrollBy(itemBottom - scrollRef.height)
    }
    // Scroll up if top of item is above viewport
    else if (itemTop < 0) {
      scrollRef.scrollBy(itemTop)
    }
  }

  // Scroll when selection changes
  createEffect(() => {
    selectedIndex() // Track dependency
    scrollToSelected()
  })

  // Re-scroll when terminal dimensions change to keep selected item visible
  createEffect(() => {
    dimensions() // Track terminal size changes
    scrollToSelected()
  })

  useKeyboard((evt) => {
    // Ignore keyboard events if component is no longer active
    if (!isActive()) return

    if (evt.name === "up") {
      setSelectedIndex((prev) => Math.max(0, prev - 1))
    } else if (evt.name === "down") {
      setSelectedIndex((prev) => Math.min(props.choices.length - 1, prev + 1))
    } else if (evt.name === "return") {
      setIsActive(false)
      props.onSelect(props.choices[selectedIndex()].value)
    } else if (evt.name === "escape") {
      setIsActive(false)
      props.onCancel?.()
    } else if (evt.name && /^[1-9]$/.test(evt.name)) {
      const num = parseInt(evt.name, 10)
      if (num >= 1 && num <= props.choices.length) {
        setIsActive(false)
        props.onSelect(props.choices[num - 1].value)
      }
    }
  })

  return (
    <box flexDirection="column" gap={1} flexShrink={1}>
      <box marginBottom={1}>
        <text fg={themeCtx.theme.primary}>◆ {props.message}</text>
      </box>

      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
        maxHeight={maxHeight()}
        scrollbarOptions={{ visible: false }}
      >
        <For each={props.choices}>
          {(choice, index) => {
            const isSelected = () => index() === selectedIndex()
            const isLast = () => index() === props.choices.length - 1
            return (
              <box flexDirection="column" gap={0} marginBottom={isLast() ? 0 : 1}>
                <box flexDirection="row" gap={1}>
                  <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                    {isSelected() ? "●" : "○"}
                  </text>
                  <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.text}>
                    {choice.title}
                  </text>
                </box>
                {choice.description && (
                  <box marginLeft={3}>
                    <text fg={themeCtx.theme.textMuted}>{choice.description}</text>
                  </box>
                )}
              </box>
            )
          }}
        </For>
      </scrollbox>

      <box marginTop={1}>
        <text fg={themeCtx.theme.textMuted}>
          ↑/↓ Navigate • Enter to select • Esc to cancel
        </text>
      </box>
    </box>
  )
}
