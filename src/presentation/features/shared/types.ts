/**
 * Shared Types
 *
 * Common types used across presentation features.
 */

import type { JSX } from 'solid-js'

// ============================================================================
// Component Types
// ============================================================================

/**
 * Base props for all components
 */
export interface BaseProps {
  /** Additional CSS classes */
  class?: string
  /** Children elements */
  children?: JSX.Element
}

/**
 * Props for components that support disabled state
 */
export interface DisableableProps {
  /** Whether the component is disabled */
  disabled?: boolean
}

/**
 * Props for focusable components
 */
export interface FocusableProps {
  /** Whether the component is focused */
  focused?: boolean
  /** Called when focus changes */
  onFocusChange?: (focused: boolean) => void
}

// ============================================================================
// Modal Types
// ============================================================================

/**
 * Modal visibility state
 */
export interface ModalState {
  /** Whether the modal is open */
  isOpen: boolean
  /** Open the modal */
  open: () => void
  /** Close the modal */
  close: () => void
  /** Toggle the modal */
  toggle: () => void
}

/**
 * Modal with data
 */
export interface ModalStateWithData<T> extends ModalState {
  /** Data passed to the modal */
  data: T | null
  /** Open modal with data */
  openWith: (data: T) => void
}

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Navigation state for lists
 */
export interface ListNavigationState {
  /** Currently selected index */
  selectedIndex: number
  /** Total number of items */
  itemCount: number
  /** Move to previous item */
  movePrevious: () => void
  /** Move to next item */
  moveNext: () => void
  /** Move to specific index */
  moveTo: (index: number) => void
  /** Move to first item */
  moveToFirst: () => void
  /** Move to last item */
  moveToLast: () => void
}

/**
 * Panel navigation state
 */
export interface PanelNavigationState {
  /** Currently active panel */
  activePanel: string
  /** Available panels */
  panels: string[]
  /** Switch to a panel */
  switchTo: (panel: string) => void
  /** Switch to next panel */
  next: () => void
  /** Switch to previous panel */
  previous: () => void
}

// ============================================================================
// Theme Types
// ============================================================================

/**
 * Theme configuration
 */
export interface Theme {
  name: string
  colors: ThemeColors
}

/**
 * Theme color definitions
 */
export interface ThemeColors {
  primary: string
  secondary: string
  background: string
  foreground: string
  muted: string
  accent: string
  success: string
  warning: string
  error: string
  info: string
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Render function type
 */
export type RenderFn<T> = (item: T, index: number) => JSX.Element

/**
 * Event handler type
 */
export type EventHandler<T = void> = T extends void ? () => void : (data: T) => void

/**
 * Async event handler type
 */
export type AsyncEventHandler<T = void> = T extends void
  ? () => Promise<void>
  : (data: T) => Promise<void>
