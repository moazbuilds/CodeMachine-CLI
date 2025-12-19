/**
 * Modal Keys Hook
 *
 * Handles keyboard shortcuts specific to modal dialogs.
 * These bindings have high priority and can override other bindings when a modal is open.
 */

import type { KeyBinding } from './types'
import { useKeyBindings, KeyBindingManager } from './use-key-bindings'

// ============================================================================
// Types
// ============================================================================

export interface ModalKeyHandlers {
  /** Escape key - close/dismiss modal */
  onClose?: () => void
  /** Enter key - confirm/accept */
  onConfirm?: () => void
  /** Tab key - focus next element */
  onFocusNext?: () => void
  /** Shift+Tab - focus previous element */
  onFocusPrevious?: () => void
  /** Arrow up - navigate options up */
  onNavigateUp?: () => void
  /** Arrow down - navigate options down */
  onNavigateDown?: () => void
  /** Y key - yes/confirm shortcut */
  onYes?: () => void
  /** N key - no/cancel shortcut */
  onNo?: () => void
}

export interface UseModalKeysOptions {
  /** Modal key handlers */
  handlers: ModalKeyHandlers
  /** Whether the modal is currently open */
  isOpen: boolean | (() => boolean)
  /** Keyboard manager (optional, uses global if not provided) */
  manager?: KeyBindingManager
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for modal-specific keyboard shortcuts
 *
 * These shortcuts only work when a modal is open and have high priority
 * to override other bindings.
 *
 * Usage:
 * ```typescript
 * useModalKeys({
 *   handlers: {
 *     onClose: () => setModalOpen(false),
 *     onConfirm: () => handleConfirm(),
 *     onYes: () => handleYes(),
 *     onNo: () => handleNo(),
 *   },
 *   isOpen: () => isModalOpen,
 * })
 * ```
 */
export const useModalKeys = (options: UseModalKeysOptions): (() => void)[] => {
  const { addBinding } = useKeyBindings(options.manager)
  const unsubscribes: (() => void)[] = []

  // Modal bindings have very high priority (90) - just below global shortcuts
  const modalPriority = 90

  // Helper to check if modal is open
  const isEnabled = (): boolean => {
    if (typeof options.isOpen === 'function') {
      return options.isOpen()
    }
    return options.isOpen
  }

  // Escape - close modal
  if (options.handlers.onClose) {
    unsubscribes.push(
      addBinding({
        key: 'escape',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onClose?.()
        },
        enabled: isEnabled,
        description: 'Close modal',
        priority: modalPriority + 5, // Escape has highest priority in modals
      })
    )
  }

  // Enter - confirm
  if (options.handlers.onConfirm) {
    unsubscribes.push(
      addBinding({
        key: 'return',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onConfirm?.()
        },
        enabled: isEnabled,
        description: 'Confirm',
        priority: modalPriority,
      })
    )
  }

  // Tab - focus next
  if (options.handlers.onFocusNext) {
    unsubscribes.push(
      addBinding({
        key: 'tab',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onFocusNext?.()
        },
        enabled: isEnabled,
        description: 'Focus next',
        priority: modalPriority,
      })
    )
  }

  // Shift+Tab - focus previous
  if (options.handlers.onFocusPrevious) {
    unsubscribes.push(
      addBinding({
        key: 'tab',
        modifiers: { shift: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onFocusPrevious?.()
        },
        enabled: isEnabled,
        description: 'Focus previous',
        priority: modalPriority + 1, // Slightly higher than plain tab
      })
    )
  }

  // Arrow up - navigate up
  if (options.handlers.onNavigateUp) {
    unsubscribes.push(
      addBinding({
        key: 'up',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onNavigateUp?.()
        },
        enabled: isEnabled,
        description: 'Navigate up',
        priority: modalPriority,
      })
    )
  }

  // Arrow down - navigate down
  if (options.handlers.onNavigateDown) {
    unsubscribes.push(
      addBinding({
        key: 'down',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onNavigateDown?.()
        },
        enabled: isEnabled,
        description: 'Navigate down',
        priority: modalPriority,
      })
    )
  }

  // Y key - yes shortcut
  if (options.handlers.onYes) {
    unsubscribes.push(
      addBinding({
        key: 'y',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onYes?.()
        },
        enabled: isEnabled,
        description: 'Yes',
        priority: modalPriority,
      })
    )
  }

  // N key - no shortcut
  if (options.handlers.onNo) {
    unsubscribes.push(
      addBinding({
        key: 'n',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onNo?.()
        },
        enabled: isEnabled,
        description: 'No',
        priority: modalPriority,
      })
    )
  }

  return unsubscribes
}
