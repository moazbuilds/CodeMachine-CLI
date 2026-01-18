/** @jsxImportSource @opentui/solid */
/**
 * DialogSelect Component
 *
 * Searchable selection dialog with categories, keybinds, and fuzzy filtering.
 * Based on OpenCode's dialog-select pattern.
 */

import {
  createMemo,
  createEffect,
  For,
  Show,
  onMount,
  batch,
} from "solid-js"
import { createStore } from "solid-js/store"
import { useTheme } from "@tui/shared/context/theme"
import { useTerminalDimensions, useKeyboard } from "@opentui/solid"
import * as fuzzysort from "fuzzysort"
import type { ScrollBoxRenderable } from "@opentui/core"
import type {
  DialogSelectProps,
  DialogSelectOption,
  DialogSelectRef,
  DialogSelectKeybind,
  GroupedOptions,
} from "./types"

export type { DialogSelectProps, DialogSelectOption, DialogSelectRef, DialogSelectKeybind } from "./types"

interface State {
  selected: number
  filter: string
}

// Deep equality check for values
function isDeepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object' || a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

export function DialogSelect<T = unknown>(props: DialogSelectProps<T>) {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollRef: ScrollBoxRenderable | undefined

  const [state, setState] = createStore<State>({
    selected: 0,
    filter: "",
  })

  // Filtered options (fuzzy search)
  const filtered = createMemo(() => {
    const opts = props.options.filter(x => x.disabled !== true)

    if (props.skipFilter) {
      props.onFilter?.(state.filter)
      return opts
    }

    const needle = state.filter.trim().toLowerCase()
    props.onFilter?.(needle)

    if (!needle) {
      return opts
    }

    // Search and deduplicate
    const results = fuzzysort.go(needle, opts, {
      keys: ["title", "category"],
      threshold: -10000,
    })

    const seen = new Set<unknown>()
    const deduped: DialogSelectOption<T>[] = []
    for (const r of results) {
      if (!seen.has(r.obj.value)) {
        seen.add(r.obj.value)
        deduped.push(r.obj)
      }
    }
    return deduped
  })

  // Group by category
  const grouped = createMemo((): [string | null, DialogSelectOption<T>[]][] => {
    const opts = filtered()
    const needle = state.filter.trim()

    // When searching, show flat list
    if (needle) {
      if (opts.length === 0) return []
      return [[null, opts]]
    }

    if (opts.length === 0) return []

    const hasCategories = opts.some((o) => o.category)
    if (!hasCategories) {
      return [[null, opts]]
    }

    const groups: Map<string | null, DialogSelectOption<T>[]> = new Map()

    for (const opt of opts) {
      const cat = opt.category ?? null
      if (!groups.has(cat)) {
        groups.set(cat, [])
      }
      groups.get(cat)!.push(opt)
    }

    return Array.from(groups.entries())
  })

  // Flattened for keyboard navigation
  const flat = createMemo(() => {
    const result: DialogSelectOption<T>[] = []
    for (const [_, options] of grouped()) {
      result.push(...options)
    }
    return result
  })

  // Currently selected option
  const selected = createMemo(() => flat()[state.selected])

  // Max height calculation
  const maxHeight = createMemo(() => {
    const h = dimensions()?.height ?? 24
    if (!h || h < 15 || !isFinite(h)) return 10
    return Math.min(flat().length + grouped().length * 2, Math.max(5, Math.floor(h / 2) - 6))
  })

  // Reset selection on filter change or current change
  createEffect(() => {
    const filter = state.filter
    const current = props.current

    if (filter.length > 0) {
      setState("selected", 0)
    } else if (current !== undefined) {
      const currentIndex = flat().findIndex((opt) => isDeepEqual(opt.value, current))
      if (currentIndex >= 0) {
        setState("selected", currentIndex)
      }
    }
    scrollRef?.scrollTo?.(0)
  })

  // Move selection with wrapping
  function move(direction: number) {
    if (flat().length === 0) return
    let next = state.selected + direction
    if (next < 0) next = flat().length - 1
    if (next >= flat().length) next = 0
    moveTo(next)
  }

  // Move to specific index and scroll
  function moveTo(next: number) {
    setState("selected", next)
    const sel = selected()
    if (sel) props.onMove?.(sel)

    if (!scrollRef) return

    // Find the target element by its ID
    const target = scrollRef.getChildren().find((child) => {
      return child.id === JSON.stringify(sel?.value)
    })
    if (!target) return

    const y = target.y - scrollRef.y
    if (y >= scrollRef.height) {
      scrollRef.scrollBy(y - scrollRef.height + 1)
    }
    if (y < 0) {
      scrollRef.scrollBy(y)
      // Scroll to top if first item
      if (isDeepEqual(flat()[0]?.value, sel?.value)) {
        scrollRef.scrollTo?.(0)
      }
    }
  }

  // Select current option
  const selectCurrent = () => {
    const opt = selected()
    if (!opt || opt.disabled) return

    if (opt.onSelect) {
      opt.onSelect()
    } else {
      props.onSelect?.(opt.value)
    }
  }

  // Match keybind
  const matchKeybind = (
    event: { name?: string; ctrl?: boolean; meta?: boolean; shift?: boolean },
    kb: DialogSelectKeybind<T>["keybind"]
  ): boolean => {
    const key = event.name?.toLowerCase() ?? ""
    const kbKey = kb.key.toLowerCase()

    return (
      key === kbKey &&
      !!event.ctrl === !!kb.ctrl &&
      !!event.meta === !!kb.meta &&
      !!event.shift === !!kb.shift
    )
  }

  // Keyboard handler
  useKeyboard((event) => {
    // Custom keybinds first
    if (props.keybind) {
      for (const kb of props.keybind) {
        if (kb.disabled) continue
        if (matchKeybind(event, kb.keybind)) {
          const opt = selected()
          if (opt) kb.onTrigger(opt)
          return
        }
      }
    }

    // Navigation
    switch (event.name) {
      case "up":
        move(-1)
        break
      case "down":
        move(1)
        break
      case "pageup":
        move(-10)
        break
      case "pagedown":
        move(10)
        break
      case "return":
        selectCurrent()
        break
      case "escape":
        props.onCancel?.()
        break
      default:
        // Ctrl+P / Ctrl+N for vim-style navigation
        if (event.ctrl && event.name === "p") {
          move(-1)
        } else if (event.ctrl && event.name === "n") {
          move(1)
        }
        // Number shortcuts 1-9
        else if (event.name && /^[1-9]$/.test(event.name) && !event.ctrl && !event.meta) {
          const idx = parseInt(event.name, 10) - 1
          const opts = flat()
          if (idx < opts.length && !opts[idx]?.disabled) {
            setState("selected", idx)
            selectCurrent()
          }
        }
    }
  })

  // Handle filter input
  const handleInput = (value: string) => {
    batch(() => {
      setState("filter", value)
      props.onFilter?.(value)
    })
  }

  // Check if option is current
  const isCurrent = (opt: DialogSelectOption<T>) => {
    if (props.current === undefined) return false
    return isDeepEqual(opt.value, props.current)
  }

  // Check if option is active (selected)
  const isActive = (opt: DialogSelectOption<T>) => {
    return isDeepEqual(opt.value, selected()?.value)
  }

  // Expose ref
  onMount(() => {
    if (props.ref) {
      props.ref({
        selectedIndex: () => state.selected,
        setSelectedIndex: (idx) => setState("selected", idx),
        getSelectedOption: () => selected(),
      })
    }
  })

  // Format keybind for display
  const formatKeybind = (kb: DialogSelectKeybind<T>["keybind"]): string => {
    const parts: string[] = []
    if (kb.ctrl) parts.push("Ctrl")
    if (kb.meta) parts.push("Alt")
    if (kb.shift) parts.push("Shift")
    parts.push(kb.key.toUpperCase())
    return parts.join("+")
  }

  return (
    <box flexDirection="column" flexShrink={1}>
      {/* Title */}
      <box marginBottom={1}>
        <text fg={theme.theme.primary} attributes={1}>
          {props.title}
        </text>
      </box>

      {/* Search Input */}
      <box
        backgroundColor={theme.theme.backgroundElement}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        marginBottom={1}
        minWidth={40}
      >
        <input
          value={state.filter}
          placeholder={props.placeholder ?? "Search..."}
          onInput={handleInput}
          focused={true}
          backgroundColor={theme.theme.backgroundElement}
          focusedBackgroundColor={theme.theme.backgroundElement}
        />
      </box>

      {/* Options */}
      <Show
        when={grouped().length > 0}
        fallback={
          <box paddingLeft={1}>
            <text fg={theme.theme.textMuted}>No results found</text>
          </box>
        }
      >
        <scrollbox
          ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
          maxHeight={maxHeight()}
          scrollbarOptions={{ visible: false }}
        >
          <For each={grouped()}>
            {([category, options], groupIndex) => (
              <>
                {/* Category header */}
                <Show when={category}>
                  <box marginTop={groupIndex() > 0 ? 1 : 0} marginBottom={1} paddingLeft={1}>
                    <text fg={theme.theme.textMuted} attributes={1}>
                      {category}
                    </text>
                  </box>
                </Show>

                {/* Options */}
                <For each={options}>
                  {(option) => {
                    const active = () => isActive(option)
                    const current = () => isCurrent(option)
                    const disabled = () => option.disabled ?? false

                    return (
                      <box
                        id={JSON.stringify(option.value)}
                        flexDirection="row"
                        paddingLeft={1}
                        paddingRight={1}
                        backgroundColor={active() ? theme.theme.backgroundElement : undefined}
                      >
                        {/* Gutter */}
                        <Show when={option.gutter}>
                          <box marginRight={1}>{option.gutter}</box>
                        </Show>

                        {/* Current indicator */}
                        <box width={2}>
                          <text fg={theme.theme.primary}>
                            {current() ? "●" : " "}
                          </text>
                        </box>

                        {/* Title */}
                        <box flexGrow={1}>
                          <text
                            fg={
                              disabled()
                                ? theme.theme.textMuted
                                : active()
                                  ? theme.theme.primary
                                  : theme.theme.text
                            }
                            attributes={active() && !disabled() ? 1 : 0}
                          >
                            {option.title}
                          </text>

                          {/* Description */}
                          <Show when={option.description}>
                            <text fg={theme.theme.textMuted}> {option.description}</text>
                          </Show>
                        </box>

                        {/* Footer */}
                        <Show when={option.footer}>
                          <box marginLeft={2}>
                            {typeof option.footer === "string" ? (
                              <text fg={theme.theme.info}>{option.footer}</text>
                            ) : (
                              option.footer
                            )}
                          </box>
                        </Show>
                      </box>
                    )
                  }}
                </For>
              </>
            )}
          </For>
        </scrollbox>
      </Show>

      {/* Keybind hints */}
      <box marginTop={1} flexDirection="row" flexWrap="wrap" gap={2}>
        <text fg={theme.theme.textMuted}>↑↓ navigate</text>
        <text fg={theme.theme.textMuted}>enter select</text>
        <text fg={theme.theme.textMuted}>esc cancel</text>

        <For each={props.keybind ?? []}>
          {(kb) => (
            <Show when={!kb.disabled}>
              <text fg={theme.theme.textMuted}>
                {formatKeybind(kb.keybind)} {kb.title}
              </text>
            </Show>
          )}
        </For>
      </box>
    </box>
  )
}
