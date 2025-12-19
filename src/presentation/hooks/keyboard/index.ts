/**
 * Modular Keyboard Handling
 *
 * A composable keyboard handling system that allows building complex
 * keyboard interactions from simple, focused hooks.
 *
 * Architecture:
 * - KeyBindingManager: Central manager for all keyboard bindings
 * - Priority system: Higher priority bindings are checked first
 * - Modular hooks: Each hook handles a specific category of keys
 *
 * Priority Levels:
 * - 100: Global shortcuts (Ctrl+key combinations, Shift+Tab)
 * - 90-95: Modal bindings (when modal is open)
 * - 30: Escape key (general)
 * - 20: Enter key (general)
 * - 10-15: Navigation and action keys
 *
 * Usage:
 * ```typescript
 * import {
 *   useGlobalShortcuts,
 *   useNavigationKeys,
 *   useActionKeys,
 *   useModalKeys,
 * } from '@/presentation/hooks/keyboard'
 *
 * function MyComponent() {
 *   // Compose keyboard handling from smaller hooks
 *   useGlobalShortcuts({
 *     handlers: {
 *       onShiftTab: () => toggleMode(),
 *       onCtrlS: () => skip(),
 *     },
 *   })
 *
 *   useNavigationKeys({
 *     actions: {
 *       navigateUp: () => moveUp(),
 *       navigateDown: () => moveDown(),
 *     },
 *     enabled: () => !isModalOpen,
 *   })
 *
 *   useActionKeys({
 *     handlers: {
 *       onEnter: () => select(),
 *       onEscape: () => cancel(),
 *     },
 *     enabled: () => !isModalOpen,
 *   })
 *
 *   useModalKeys({
 *     handlers: {
 *       onClose: () => closeModal(),
 *       onConfirm: () => confirm(),
 *     },
 *     isOpen: isModalOpen,
 *   })
 * }
 * ```
 */

// Core types
export type {
  KeyEvent,
  KeyHandler,
  KeyName,
  KeyBinding,
  KeyBindingGroup,
  KeyboardContext,
  UseKeyBindingsResult,
} from './types'

// Core binding manager
export {
  KeyBindingManager,
  useKeyBindings,
  getKeyBindingManager,
  resetKeyBindingManager,
} from './use-key-bindings'

// Specialized hooks
export { useNavigationKeys } from './use-navigation-keys'
export type { NavigationKeyActions, UseNavigationKeysOptions } from './use-navigation-keys'

export { useActionKeys } from './use-action-keys'
export type { ActionKeyHandlers, UseActionKeysOptions } from './use-action-keys'

export { useGlobalShortcuts } from './use-global-shortcuts'
export type { GlobalShortcutHandlers, UseGlobalShortcutsOptions } from './use-global-shortcuts'

export { useModalKeys } from './use-modal-keys'
export type { ModalKeyHandlers, UseModalKeysOptions } from './use-modal-keys'

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a composite keyboard handler from multiple hooks
 *
 * This utility helps create a unified cleanup function for all keyboard hooks.
 *
 * @example
 * ```typescript
 * const cleanup = createKeyboardHandler([
 *   () => useGlobalShortcuts({ handlers: { onCtrlS: skip } }),
 *   () => useNavigationKeys({ actions: { navigateUp, navigateDown } }),
 *   () => useActionKeys({ handlers: { onEnter: select } }),
 * ])
 *
 * // Later, clean up all handlers
 * cleanup()
 * ```
 */
export function createKeyboardHandler(
  hookFactories: Array<() => (() => void)[]>
): () => void {
  const allUnsubscribes: (() => void)[] = []

  for (const factory of hookFactories) {
    const unsubscribes = factory()
    allUnsubscribes.push(...unsubscribes)
  }

  return () => {
    for (const unsubscribe of allUnsubscribes) {
      unsubscribe()
    }
  }
}

/**
 * Check if a key event matches a specific key and modifiers
 *
 * @example
 * ```typescript
 * if (matchesKey(event, 's', { ctrl: true })) {
 *   // Handle Ctrl+S
 * }
 * ```
 */
export function matchesKey(
  event: { name: string; ctrl: boolean; shift: boolean; meta: boolean; alt: boolean },
  key: string,
  modifiers?: { ctrl?: boolean; shift?: boolean; meta?: boolean; alt?: boolean }
): boolean {
  if (event.name !== key) return false

  const mods = modifiers ?? {}
  if (!!mods.ctrl !== event.ctrl) return false
  if (!!mods.shift !== event.shift) return false
  if (!!mods.meta !== event.meta) return false
  if (!!mods.alt !== event.alt) return false

  return true
}

/**
 * Format a key binding for display (e.g., in help text)
 *
 * @example
 * ```typescript
 * formatKeyBinding('s', { ctrl: true }) // "Ctrl+S"
 * formatKeyBinding('tab', { shift: true }) // "Shift+Tab"
 * ```
 */
export function formatKeyBinding(
  key: string,
  modifiers?: { ctrl?: boolean; shift?: boolean; meta?: boolean; alt?: boolean }
): string {
  const parts: string[] = []

  if (modifiers?.ctrl) parts.push('Ctrl')
  if (modifiers?.alt) parts.push('Alt')
  if (modifiers?.shift) parts.push('Shift')
  if (modifiers?.meta) parts.push('Cmd')

  // Capitalize key name
  const keyName = key.charAt(0).toUpperCase() + key.slice(1)
  parts.push(keyName)

  return parts.join('+')
}
