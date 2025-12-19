/**
 * Use Home Keyboard Hook
 *
 * Manages keyboard shortcuts for the home screen.
 */

import {
  useNavigationKeys,
  useActionKeys,
  useGlobalShortcuts,
} from '../../../hooks/keyboard'
import type { HomeActions, HomeCommand } from '../types'

/**
 * Options for home keyboard hook
 */
export interface UseHomeKeyboardOptions {
  /** Home actions */
  actions: HomeActions
  /** Available commands */
  commands: HomeCommand[]
  /** Current selected index */
  selectedIndex: number
  /** Whether input is focused */
  isInputFocused?: boolean
}

/**
 * Set up keyboard handlers for home screen
 *
 * @example
 * ```typescript
 * useHomeKeyboard({
 *   actions,
 *   commands,
 *   selectedIndex: state.selectedCommand,
 *   isInputFocused: false,
 * })
 * ```
 */
export function useHomeKeyboard(options: UseHomeKeyboardOptions): (() => void)[] {
  const unsubscribes: (() => void)[] = []

  // Navigation keys (up/down)
  unsubscribes.push(
    ...useNavigationKeys({
      actions: {
        navigateUp: () => {
          const newIndex = Math.max(0, options.selectedIndex - 1)
          options.actions.selectCommand(newIndex)
        },
        navigateDown: () => {
          const maxIndex = options.commands.length - 1
          const newIndex = Math.min(maxIndex, options.selectedIndex + 1)
          options.actions.selectCommand(newIndex)
        },
        jumpToFirst: () => {
          options.actions.selectCommand(0)
        },
        jumpToLast: () => {
          options.actions.selectCommand(options.commands.length - 1)
        },
      },
      enabled: () => !options.isInputFocused,
    })
  )

  // Action keys (Enter, Escape)
  unsubscribes.push(
    ...useActionKeys({
      handlers: {
        onEnter: () => {
          const selectedCmd = options.commands[options.selectedIndex]
          if (selectedCmd) {
            options.actions.setInput(selectedCmd.command)
            options.actions.submitCommand()
          }
        },
        onEscape: () => {
          options.actions.toggleHelp()
        },
      },
      enabled: () => !options.isInputFocused,
    })
  )

  // Global shortcuts (Ctrl+Q for quit)
  unsubscribes.push(
    ...useGlobalShortcuts({
      handlers: {
        onCtrlQ: () => {
          options.actions.navigateTo('quit')
        },
        onCtrlH: () => {
          options.actions.toggleHelp()
        },
      },
    })
  )

  // Command shortcuts (r, n, c, q, ?)
  // These are handled separately as single-key shortcuts

  return unsubscribes
}
