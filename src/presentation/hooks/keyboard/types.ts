/**
 * Keyboard Handling Types
 *
 * Shared types for modular keyboard hooks.
 */

// ============================================================================
// Key Event Types
// ============================================================================

export interface KeyEvent {
  name: string
  shift: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  preventDefault: () => void
}

export type KeyHandler = (event: KeyEvent) => void | boolean

export type KeyName =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'return'
  | 'escape'
  | 'tab'
  | 'space'
  | 'backspace'
  | 'delete'
  | string // Single character keys

// ============================================================================
// Key Binding Types
// ============================================================================

export interface KeyBinding {
  /** Key name or pattern */
  key: KeyName
  /** Handler function */
  handler: KeyHandler
  /** Optional modifiers */
  modifiers?: {
    ctrl?: boolean
    shift?: boolean
    meta?: boolean
    alt?: boolean
  }
  /** Description for help text */
  description?: string
  /** Whether this binding is currently enabled */
  enabled?: boolean | (() => boolean)
  /** Priority (higher = checked first) */
  priority?: number
}

export interface KeyBindingGroup {
  /** Group name */
  name: string
  /** Bindings in this group */
  bindings: KeyBinding[]
  /** Whether the group is enabled */
  enabled?: boolean | (() => boolean)
  /** Priority for the entire group */
  priority?: number
}

// ============================================================================
// Hook Context Types
// ============================================================================

export interface KeyboardContext {
  /** Whether a modal is currently blocking */
  isModalBlocking: boolean
  /** Whether an input is focused */
  isInputFocused: boolean
  /** Current focus target */
  focusTarget: 'none' | 'input' | 'modal' | 'list'
  /** Whether the workflow is running */
  isWorkflowRunning: boolean
  /** Whether waiting for user input */
  isWaitingForInput: boolean
}

// ============================================================================
// Hook Result Types
// ============================================================================

export interface UseKeyBindingsResult {
  /** Add a binding dynamically */
  addBinding: (binding: KeyBinding) => () => void
  /** Remove a binding */
  removeBinding: (key: KeyName, modifiers?: KeyBinding['modifiers']) => void
  /** Enable/disable a binding */
  setEnabled: (key: KeyName, enabled: boolean) => void
  /** Get all current bindings */
  getBindings: () => KeyBinding[]
}
