/**
 * Use Home State Hook
 *
 * Manages state for the home screen.
 */

import { createSignal } from 'solid-js'
import type { HomeState, HomeActions, HomeCommand } from '../types'

/**
 * Default commands for home screen
 */
export const DEFAULT_HOME_COMMANDS: HomeCommand[] = [
  { command: 'run', description: 'Run a workflow', shortcut: 'r' },
  { command: 'new', description: 'Create a new project', shortcut: 'n' },
  { command: 'config', description: 'Configure settings', shortcut: 'c' },
  { command: 'help', description: 'Show help', shortcut: '?' },
  { command: 'quit', description: 'Exit the application', shortcut: 'q' },
]

/**
 * Options for home state hook
 */
export interface UseHomeStateOptions {
  /** Available commands */
  commands?: HomeCommand[]
  /** Navigate function */
  onNavigate?: (route: string) => void
  /** Command submit handler */
  onSubmit?: (command: string) => void
}

/**
 * Home state and actions
 */
export interface UseHomeStateResult {
  /** Current state */
  state: HomeState
  /** Actions to modify state */
  actions: HomeActions
  /** Available commands */
  commands: HomeCommand[]
}

/**
 * Create home screen state
 *
 * @example
 * ```typescript
 * const { state, actions, commands } = useHomeState({
 *   onNavigate: (route) => router.push(route),
 *   onSubmit: (cmd) => executeCommand(cmd),
 * })
 * ```
 */
export function useHomeState(options: UseHomeStateOptions = {}): UseHomeStateResult {
  const commands = options.commands ?? DEFAULT_HOME_COMMANDS

  const [inputValue, setInputValue] = createSignal('')
  const [selectedCommand, setSelectedCommand] = createSignal(0)
  const [showHelp, setShowHelp] = createSignal(false)
  const [recentCommands, setRecentCommands] = createSignal<string[]>([])

  const state: HomeState = {
    get inputValue() {
      return inputValue()
    },
    get selectedCommand() {
      return selectedCommand()
    },
    get showHelp() {
      return showHelp()
    },
    get recentCommands() {
      return recentCommands()
    },
  }

  const actions: HomeActions = {
    setInput: setInputValue,

    submitCommand: () => {
      const value = inputValue().trim()
      if (!value) return

      // Add to recent commands
      setRecentCommands((prev) => {
        const filtered = prev.filter((c) => c !== value)
        return [value, ...filtered].slice(0, 10)
      })

      // Clear input
      setInputValue('')

      // Call submit handler
      options.onSubmit?.(value)
    },

    selectCommand: (index: number) => {
      const maxIndex = commands.length - 1
      setSelectedCommand(Math.max(0, Math.min(index, maxIndex)))
    },

    toggleHelp: () => {
      setShowHelp((prev) => !prev)
    },

    navigateTo: (route: string) => {
      options.onNavigate?.(route)
    },
  }

  return { state, actions, commands }
}
