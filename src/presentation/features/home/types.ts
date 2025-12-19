/**
 * Home Feature Types
 */

/**
 * Command definition for home screen
 */
export interface HomeCommand {
  /** Command keyword */
  command: string
  /** Command description */
  description: string
  /** Keyboard shortcut */
  shortcut?: string
  /** Whether the command is enabled */
  enabled?: boolean
}

/**
 * Home screen state
 */
export interface HomeState {
  /** Current input value */
  inputValue: string
  /** Selected command index */
  selectedCommand: number
  /** Whether help is visible */
  showHelp: boolean
  /** Recent commands */
  recentCommands: string[]
}

/**
 * Home screen actions
 */
export interface HomeActions {
  /** Set input value */
  setInput: (value: string) => void
  /** Submit command */
  submitCommand: () => void
  /** Select a command */
  selectCommand: (index: number) => void
  /** Toggle help visibility */
  toggleHelp: () => void
  /** Navigate to a route */
  navigateTo: (route: string) => void
}
