/**
 * Action Keys Hook
 *
 * Handles action-related keyboard shortcuts like Enter, Escape, Space.
 */

import type { KeyBinding } from './types'
import { useKeyBindings, KeyBindingManager } from './use-key-bindings'

// ============================================================================
// Types
// ============================================================================

export interface ActionKeyHandlers {
  /** Enter key - confirm, select, or submit */
  onEnter?: () => void
  /** Escape key - cancel, close, or go back */
  onEscape?: () => void
  /** Space key - toggle or select */
  onSpace?: () => void
  /** Backspace key - delete or go back */
  onBackspace?: () => void
  /** Delete key - delete item */
  onDelete?: () => void
}

export interface UseActionKeysOptions {
  /** Action handlers */
  handlers: ActionKeyHandlers
  /** Whether actions are enabled */
  enabled?: boolean | (() => boolean)
  /** Keyboard manager (optional, uses global if not provided) */
  manager?: KeyBindingManager
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for action keyboard shortcuts
 *
 * Handles:
 * - Enter: Confirm/select/submit
 * - Escape: Cancel/close/back
 * - Space: Toggle/select
 * - Backspace/Delete: Delete actions
 *
 * Usage:
 * ```typescript
 * useActionKeys({
 *   handlers: {
 *     onEnter: () => confirmSelection(),
 *     onEscape: () => closeModal(),
 *     onSpace: () => toggleItem(),
 *   },
 *   enabled: () => !isInputFocused,
 * })
 * ```
 */
export const useActionKeys = (options: UseActionKeysOptions): (() => void)[] => {
  const { addBinding } = useKeyBindings(options.manager)
  const unsubscribes: (() => void)[] = []

  // Enter key
  if (options.handlers.onEnter) {
    unsubscribes.push(
      addBinding({
        key: 'return',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onEnter?.()
        },
        enabled: options.enabled,
        description: 'Confirm/Select',
        priority: 20,
      })
    )
  }

  // Escape key
  if (options.handlers.onEscape) {
    unsubscribes.push(
      addBinding({
        key: 'escape',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onEscape?.()
        },
        enabled: options.enabled,
        description: 'Cancel/Close',
        priority: 30, // Higher priority - escape should work first
      })
    )
  }

  // Space key
  if (options.handlers.onSpace) {
    unsubscribes.push(
      addBinding({
        key: 'space',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onSpace?.()
        },
        enabled: options.enabled,
        description: 'Toggle/Select',
        priority: 15,
      })
    )
  }

  // Backspace key
  if (options.handlers.onBackspace) {
    unsubscribes.push(
      addBinding({
        key: 'backspace',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onBackspace?.()
        },
        enabled: options.enabled,
        description: 'Go back/Delete',
        priority: 10,
      })
    )
  }

  // Delete key
  if (options.handlers.onDelete) {
    unsubscribes.push(
      addBinding({
        key: 'delete',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onDelete?.()
        },
        enabled: options.enabled,
        description: 'Delete',
        priority: 10,
      })
    )
  }

  return unsubscribes
}
