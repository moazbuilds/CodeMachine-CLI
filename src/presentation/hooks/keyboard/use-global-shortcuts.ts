/**
 * Global Shortcuts Hook
 *
 * Handles global keyboard shortcuts that work regardless of context.
 * These are typically Ctrl/Cmd+key combinations.
 */

import type { KeyBinding } from './types'
import { useKeyBindings, KeyBindingManager } from './use-key-bindings'

// ============================================================================
// Types
// ============================================================================

export interface GlobalShortcutHandlers {
  /** Ctrl+S - Save or Skip */
  onCtrlS?: () => void
  /** Ctrl+C - Copy or Cancel */
  onCtrlC?: () => void
  /** Ctrl+V - Paste */
  onCtrlV?: () => void
  /** Ctrl+Z - Undo */
  onCtrlZ?: () => void
  /** Ctrl+Y or Ctrl+Shift+Z - Redo */
  onCtrlY?: () => void
  /** Ctrl+Q - Quit */
  onCtrlQ?: () => void
  /** Ctrl+P - Pause or Print */
  onCtrlP?: () => void
  /** Ctrl+R - Refresh or Restart */
  onCtrlR?: () => void
  /** Ctrl+H - History or Help */
  onCtrlH?: () => void
  /** Shift+Tab - Toggle mode */
  onShiftTab?: () => void
  /** Tab - Toggle panel */
  onTab?: () => void
}

export interface UseGlobalShortcutsOptions {
  /** Shortcut handlers */
  handlers: GlobalShortcutHandlers
  /** Keyboard manager (optional, uses global if not provided) */
  manager?: KeyBindingManager
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for global keyboard shortcuts
 *
 * These shortcuts work regardless of modal or focus state.
 * They have the highest priority.
 *
 * Usage:
 * ```typescript
 * useGlobalShortcuts({
 *   handlers: {
 *     onCtrlS: () => handleSkip(),
 *     onShiftTab: () => toggleAutopilotMode(),
 *     onTab: () => toggleTimelinePanel(),
 *   },
 * })
 * ```
 */
export const useGlobalShortcuts = (options: UseGlobalShortcutsOptions): (() => void)[] => {
  const { addBinding } = useKeyBindings(options.manager)
  const unsubscribes: (() => void)[] = []

  // Global shortcuts have highest priority (100)
  const globalPriority = 100

  // Ctrl+S
  if (options.handlers.onCtrlS) {
    unsubscribes.push(
      addBinding({
        key: 's',
        modifiers: { ctrl: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlS?.()
        },
        description: 'Skip/Save',
        priority: globalPriority,
      })
    )
  }

  // Ctrl+C
  if (options.handlers.onCtrlC) {
    unsubscribes.push(
      addBinding({
        key: 'c',
        modifiers: { ctrl: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlC?.()
        },
        description: 'Copy/Cancel',
        priority: globalPriority,
      })
    )
  }

  // Ctrl+V
  if (options.handlers.onCtrlV) {
    unsubscribes.push(
      addBinding({
        key: 'v',
        modifiers: { ctrl: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlV?.()
        },
        description: 'Paste',
        priority: globalPriority,
      })
    )
  }

  // Ctrl+Z
  if (options.handlers.onCtrlZ) {
    unsubscribes.push(
      addBinding({
        key: 'z',
        modifiers: { ctrl: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlZ?.()
        },
        description: 'Undo',
        priority: globalPriority,
      })
    )
  }

  // Ctrl+Y (Redo)
  if (options.handlers.onCtrlY) {
    unsubscribes.push(
      addBinding({
        key: 'y',
        modifiers: { ctrl: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlY?.()
        },
        description: 'Redo',
        priority: globalPriority,
      })
    )

    // Also support Ctrl+Shift+Z for redo
    unsubscribes.push(
      addBinding({
        key: 'z',
        modifiers: { ctrl: true, shift: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlY?.()
        },
        description: 'Redo',
        priority: globalPriority,
      })
    )
  }

  // Ctrl+Q
  if (options.handlers.onCtrlQ) {
    unsubscribes.push(
      addBinding({
        key: 'q',
        modifiers: { ctrl: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlQ?.()
        },
        description: 'Quit',
        priority: globalPriority,
      })
    )
  }

  // Ctrl+P
  if (options.handlers.onCtrlP) {
    unsubscribes.push(
      addBinding({
        key: 'p',
        modifiers: { ctrl: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlP?.()
        },
        description: 'Pause',
        priority: globalPriority,
      })
    )
  }

  // Ctrl+R
  if (options.handlers.onCtrlR) {
    unsubscribes.push(
      addBinding({
        key: 'r',
        modifiers: { ctrl: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlR?.()
        },
        description: 'Refresh/Restart',
        priority: globalPriority,
      })
    )
  }

  // Ctrl+H
  if (options.handlers.onCtrlH) {
    unsubscribes.push(
      addBinding({
        key: 'h',
        modifiers: { ctrl: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onCtrlH?.()
        },
        description: 'History/Help',
        priority: globalPriority,
      })
    )
  }

  // Shift+Tab (mode toggle)
  if (options.handlers.onShiftTab) {
    unsubscribes.push(
      addBinding({
        key: 'tab',
        modifiers: { shift: true },
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onShiftTab?.()
        },
        description: 'Toggle mode',
        priority: globalPriority,
      })
    )
  }

  // Tab (panel toggle) - slightly lower priority than Shift+Tab
  if (options.handlers.onTab) {
    unsubscribes.push(
      addBinding({
        key: 'tab',
        handler: (evt) => {
          evt.preventDefault()
          options.handlers.onTab?.()
        },
        description: 'Toggle panel',
        priority: globalPriority - 1,
      })
    )
  }

  return unsubscribes
}
