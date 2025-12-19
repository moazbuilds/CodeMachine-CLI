/**
 * Navigation Keys Hook
 *
 * Handles arrow keys and navigation-related keyboard shortcuts.
 */

import type { KeyBinding } from './types'
import { useKeyBindings, KeyBindingManager } from './use-key-bindings'

// ============================================================================
// Types
// ============================================================================

export interface NavigationKeyActions {
  /** Navigate up in a list */
  navigateUp: () => void
  /** Navigate down in a list */
  navigateDown: () => void
  /** Navigate left (e.g., collapse, previous panel) */
  navigateLeft?: () => void
  /** Navigate right (e.g., expand, next panel) */
  navigateRight?: () => void
  /** Jump to first item */
  jumpToFirst?: () => void
  /** Jump to last item */
  jumpToLast?: () => void
  /** Page up */
  pageUp?: () => void
  /** Page down */
  pageDown?: () => void
}

export interface UseNavigationKeysOptions {
  /** Navigation actions */
  actions: NavigationKeyActions
  /** Whether navigation is enabled */
  enabled?: boolean | (() => boolean)
  /** Keyboard manager (optional, uses global if not provided) */
  manager?: KeyBindingManager
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for navigation keyboard shortcuts
 *
 * Handles:
 * - Arrow up/down: Navigate list
 * - Arrow left/right: Expand/collapse or panel navigation
 * - Home/End: Jump to first/last
 * - Page Up/Down: Scroll pages
 *
 * Usage:
 * ```typescript
 * useNavigationKeys({
 *   actions: {
 *     navigateUp: () => setSelectedIndex(i => Math.max(0, i - 1)),
 *     navigateDown: () => setSelectedIndex(i => Math.min(max, i + 1)),
 *   },
 *   enabled: () => !isModalOpen,
 * })
 * ```
 */
export const useNavigationKeys = (options: UseNavigationKeysOptions): (() => void)[] => {
  const { addBinding } = useKeyBindings(options.manager)
  const unsubscribes: (() => void)[] = []

  // Arrow up
  unsubscribes.push(
    addBinding({
      key: 'up',
      handler: (evt) => {
        evt.preventDefault()
        options.actions.navigateUp()
      },
      enabled: options.enabled,
      description: 'Navigate up',
      priority: 10,
    })
  )

  // Arrow down
  unsubscribes.push(
    addBinding({
      key: 'down',
      handler: (evt) => {
        evt.preventDefault()
        options.actions.navigateDown()
      },
      enabled: options.enabled,
      description: 'Navigate down',
      priority: 10,
    })
  )

  // Arrow left (optional)
  if (options.actions.navigateLeft) {
    unsubscribes.push(
      addBinding({
        key: 'left',
        handler: (evt) => {
          evt.preventDefault()
          options.actions.navigateLeft?.()
        },
        enabled: options.enabled,
        description: 'Navigate left',
        priority: 10,
      })
    )
  }

  // Arrow right (optional)
  if (options.actions.navigateRight) {
    unsubscribes.push(
      addBinding({
        key: 'right',
        handler: (evt) => {
          evt.preventDefault()
          options.actions.navigateRight?.()
        },
        enabled: options.enabled,
        description: 'Navigate right',
        priority: 10,
      })
    )
  }

  // Home - jump to first (optional)
  if (options.actions.jumpToFirst) {
    unsubscribes.push(
      addBinding({
        key: 'home',
        handler: (evt) => {
          evt.preventDefault()
          options.actions.jumpToFirst?.()
        },
        enabled: options.enabled,
        description: 'Jump to first',
        priority: 10,
      })
    )
  }

  // End - jump to last (optional)
  if (options.actions.jumpToLast) {
    unsubscribes.push(
      addBinding({
        key: 'end',
        handler: (evt) => {
          evt.preventDefault()
          options.actions.jumpToLast?.()
        },
        enabled: options.enabled,
        description: 'Jump to last',
        priority: 10,
      })
    )
  }

  // Page up (optional)
  if (options.actions.pageUp) {
    unsubscribes.push(
      addBinding({
        key: 'pageup',
        handler: (evt) => {
          evt.preventDefault()
          options.actions.pageUp?.()
        },
        enabled: options.enabled,
        description: 'Page up',
        priority: 10,
      })
    )
  }

  // Page down (optional)
  if (options.actions.pageDown) {
    unsubscribes.push(
      addBinding({
        key: 'pagedown',
        handler: (evt) => {
          evt.preventDefault()
          options.actions.pageDown?.()
        },
        enabled: options.enabled,
        description: 'Page down',
        priority: 10,
      })
    )
  }

  return unsubscribes
}
