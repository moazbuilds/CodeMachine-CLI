/**
 * Use List Navigation Hook
 *
 * Manages navigation state for lists.
 */

import { createSignal, createMemo } from 'solid-js'
import type { ListNavigationState } from '../types'

/**
 * Options for list navigation
 */
export interface UseListNavigationOptions {
  /** Total number of items */
  itemCount: number
  /** Initial selected index */
  initialIndex?: number
  /** Whether to wrap around at boundaries */
  wrap?: boolean
  /** Called when selection changes */
  onSelectionChange?: (index: number) => void
}

/**
 * Create list navigation state
 *
 * @example
 * ```typescript
 * const nav = useListNavigation({
 *   itemCount: items().length,
 *   wrap: true,
 *   onSelectionChange: (index) => console.log('Selected:', index),
 * })
 *
 * // Use with keyboard hooks
 * useNavigationKeys({
 *   actions: {
 *     navigateUp: nav.movePrevious,
 *     navigateDown: nav.moveNext,
 *     jumpToFirst: nav.moveToFirst,
 *     jumpToLast: nav.moveToLast,
 *   },
 * })
 * ```
 */
export function useListNavigation(options: UseListNavigationOptions): ListNavigationState {
  const [selectedIndex, setSelectedIndex] = createSignal(options.initialIndex ?? 0)

  const itemCount = createMemo(() => options.itemCount)
  const wrap = () => options.wrap ?? false

  const movePrevious = () => {
    setSelectedIndex((current) => {
      const count = itemCount()
      if (count === 0) return 0

      if (current <= 0) {
        return wrap() ? count - 1 : 0
      }
      return current - 1
    })
    options.onSelectionChange?.(selectedIndex())
  }

  const moveNext = () => {
    setSelectedIndex((current) => {
      const count = itemCount()
      if (count === 0) return 0

      if (current >= count - 1) {
        return wrap() ? 0 : count - 1
      }
      return current + 1
    })
    options.onSelectionChange?.(selectedIndex())
  }

  const moveTo = (index: number) => {
    const count = itemCount()
    if (count === 0) return

    const clampedIndex = Math.max(0, Math.min(index, count - 1))
    setSelectedIndex(clampedIndex)
    options.onSelectionChange?.(clampedIndex)
  }

  const moveToFirst = () => {
    setSelectedIndex(0)
    options.onSelectionChange?.(0)
  }

  const moveToLast = () => {
    const count = itemCount()
    const lastIndex = Math.max(0, count - 1)
    setSelectedIndex(lastIndex)
    options.onSelectionChange?.(lastIndex)
  }

  return {
    get selectedIndex() {
      return selectedIndex()
    },
    get itemCount() {
      return itemCount()
    },
    movePrevious,
    moveNext,
    moveTo,
    moveToFirst,
    moveToLast,
  }
}
