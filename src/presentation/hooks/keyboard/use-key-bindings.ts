/**
 * Key Bindings Hook
 *
 * Core hook for managing keyboard bindings with priority and grouping.
 */

import type {
  KeyEvent,
  KeyBinding,
  KeyBindingGroup,
  UseKeyBindingsResult,
  KeyName,
} from './types'

// ============================================================================
// Binding Manager
// ============================================================================

export class KeyBindingManager {
  private bindings: KeyBinding[] = []
  private groups: KeyBindingGroup[] = []

  /**
   * Add a single binding
   */
  addBinding(binding: KeyBinding): () => void {
    this.bindings.push(binding)
    this.sortBindings()

    // Return unsubscribe function
    return () => this.removeBinding(binding.key, binding.modifiers)
  }

  /**
   * Add a group of bindings
   */
  addGroup(group: KeyBindingGroup): () => void {
    this.groups.push(group)

    // Return unsubscribe function
    return () => {
      const index = this.groups.indexOf(group)
      if (index !== -1) {
        this.groups.splice(index, 1)
      }
    }
  }

  /**
   * Remove a binding
   */
  removeBinding(key: KeyName, modifiers?: KeyBinding['modifiers']): void {
    this.bindings = this.bindings.filter(
      b => !(b.key === key && this.modifiersMatch(b.modifiers, modifiers))
    )
  }

  /**
   * Set binding enabled state
   */
  setEnabled(key: KeyName, enabled: boolean, modifiers?: KeyBinding['modifiers']): void {
    const binding = this.bindings.find(
      b => b.key === key && this.modifiersMatch(b.modifiers, modifiers)
    )
    if (binding) {
      binding.enabled = enabled
    }
  }

  /**
   * Get all bindings (including from groups)
   */
  getAllBindings(): KeyBinding[] {
    const allBindings: KeyBinding[] = [...this.bindings]

    for (const group of this.groups) {
      if (this.isEnabled(group.enabled)) {
        for (const binding of group.bindings) {
          allBindings.push({
            ...binding,
            priority: binding.priority ?? group.priority ?? 0,
          })
        }
      }
    }

    return allBindings.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  /**
   * Handle a key event
   */
  handleKeyEvent(event: KeyEvent): boolean {
    const bindings = this.getAllBindings()

    for (const binding of bindings) {
      if (!this.isEnabled(binding.enabled)) {
        continue
      }

      if (this.matches(event, binding)) {
        const result = binding.handler(event)
        // If handler returns true or undefined, consider it handled
        if (result !== false) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Clear all bindings
   */
  clear(): void {
    this.bindings = []
    this.groups = []
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private sortBindings(): void {
    this.bindings.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  private matches(event: KeyEvent, binding: KeyBinding): boolean {
    // Check key name
    if (event.name !== binding.key) {
      return false
    }

    // Check modifiers
    const mods = binding.modifiers ?? {}
    if (!!mods.ctrl !== event.ctrl) return false
    if (!!mods.shift !== event.shift) return false
    if (!!mods.meta !== event.meta) return false
    if (!!mods.alt !== event.alt) return false

    return true
  }

  private modifiersMatch(
    a: KeyBinding['modifiers'],
    b: KeyBinding['modifiers']
  ): boolean {
    const aCtrl = a?.ctrl ?? false
    const bCtrl = b?.ctrl ?? false
    const aShift = a?.shift ?? false
    const bShift = b?.shift ?? false
    const aMeta = a?.meta ?? false
    const bMeta = b?.meta ?? false
    const aAlt = a?.alt ?? false
    const bAlt = b?.alt ?? false

    return aCtrl === bCtrl && aShift === bShift && aMeta === bMeta && aAlt === bAlt
  }

  private isEnabled(enabled: boolean | (() => boolean) | undefined): boolean {
    if (enabled === undefined) return true
    if (typeof enabled === 'function') return enabled()
    return enabled
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalManager: KeyBindingManager | null = null

export const getKeyBindingManager = (): KeyBindingManager => {
  if (!globalManager) {
    globalManager = new KeyBindingManager()
  }
  return globalManager
}

export const resetKeyBindingManager = (): void => {
  globalManager?.clear()
  globalManager = null
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for registering key bindings
 *
 * Usage:
 * ```typescript
 * const { addBinding } = useKeyBindings()
 *
 * // Add a binding
 * const unsubscribe = addBinding({
 *   key: 'escape',
 *   handler: () => closeModal(),
 *   description: 'Close modal',
 * })
 *
 * // Clean up
 * onCleanup(() => unsubscribe())
 * ```
 */
export const useKeyBindings = (manager?: KeyBindingManager): UseKeyBindingsResult => {
  const mgr = manager ?? getKeyBindingManager()

  return {
    addBinding: (binding: KeyBinding) => mgr.addBinding(binding),
    removeBinding: (key: KeyName, modifiers?: KeyBinding['modifiers']) =>
      mgr.removeBinding(key, modifiers),
    setEnabled: (key: KeyName, enabled: boolean) => mgr.setEnabled(key, enabled),
    getBindings: () => mgr.getAllBindings(),
  }
}
