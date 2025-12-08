/**
 * History Navigation Hook
 *
 * Manages selection, scroll, and keyboard navigation for history view.
 */

import { createSignal, createMemo, createEffect, onCleanup } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { FlattenedAgent } from "./history-tree"

export interface UseHistoryNavigationOptions {
  flattenedAgents: () => FlattenedAgent[]
  initialSelectedIndex?: number
  onSelectedIndexChange?: (index: number) => void
  onClose: () => void
  onOpenLogViewer: (monitoringId: number) => void
  onClearHistory?: () => void
  disabled?: boolean
}

export function useHistoryNavigation(options: UseHistoryNavigationOptions) {
  const dimensions = useTerminalDimensions()
  const [selectedIndex, setSelectedIndexRaw] = createSignal(options.initialSelectedIndex ?? 0)
  const [scrollOffset, setScrollOffset] = createSignal(0)
  const [pauseUpdates, setPauseUpdates] = createSignal(false)

  const setSelectedIndex = (valueOrFn: number | ((prev: number) => number)) => {
    setSelectedIndexRaw((prev) => {
      const newValue = typeof valueOrFn === "function" ? valueOrFn(prev) : valueOrFn
      options.onSelectedIndexChange?.(newValue)
      return newValue
    })
  }

  const visibleLines = createMemo(() => {
    const height = dimensions()?.height ?? 40
    return Math.max(5, height - 8)
  })

  // Clamp selected index
  createEffect(() => {
    const agents = options.flattenedAgents()
    const idx = selectedIndex()
    if (idx >= agents.length && agents.length > 0) {
      setSelectedIndex(agents.length - 1)
    }
  })

  // Auto-scroll to keep selected item visible
  createEffect(() => {
    const idx = selectedIndex()
    const offset = scrollOffset()
    const visible = visibleLines()
    if (idx < offset) {
      setScrollOffset(idx)
    } else if (idx >= offset + visible) {
      setScrollOffset(idx - visible + 1)
    }
  })

  // Auto-resume updates after 2 seconds
  createEffect(() => {
    if (pauseUpdates()) {
      const timeout = setTimeout(() => setPauseUpdates(false), 2000)
      onCleanup(() => clearTimeout(timeout))
    }
  })

  const handleInteraction = () => {
    if (!pauseUpdates()) setPauseUpdates(true)
  }

  const visibleAgents = createMemo(() => {
    const agents = options.flattenedAgents()
    return agents.slice(scrollOffset(), scrollOffset() + visibleLines())
  })

  useKeyboard((evt) => {
    if (options.disabled) return

    if (evt.name === "h" || evt.name === "escape") {
      evt.preventDefault()
      options.onClose()
      return
    }

    if (evt.name === "up") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex((prev) => Math.max(0, prev - 1))
      return
    }

    if (evt.name === "down") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex((prev) => Math.min(options.flattenedAgents().length - 1, prev + 1))
      return
    }

    if (evt.name === "pageup") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex((prev) => Math.max(0, prev - visibleLines()))
      return
    }

    if (evt.name === "pagedown") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex((prev) => Math.min(options.flattenedAgents().length - 1, prev + visibleLines()))
      return
    }

    if (evt.name === "g" && !evt.shift) {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex(0)
      return
    }

    if (evt.shift && evt.name === "g") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex(options.flattenedAgents().length - 1)
      return
    }

    if (evt.name === "return") {
      evt.preventDefault()
      const agents = options.flattenedAgents()
      const selected = agents[selectedIndex()]
      if (selected) {
        options.onOpenLogViewer(selected.agent.id)
      }
      return
    }

    // Ctrl+D to clear history
    if (evt.ctrl && evt.name === "d") {
      evt.preventDefault()
      options.onClearHistory?.()
      return
    }
  })

  return {
    selectedIndex,
    scrollOffset,
    visibleLines,
    visibleAgents,
    pauseUpdates,
  }
}
