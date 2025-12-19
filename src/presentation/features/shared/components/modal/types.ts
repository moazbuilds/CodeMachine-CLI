/**
 * Modal Component Types
 */

import type { JSX } from 'solid-js'

/**
 * Base modal props
 */
export interface ModalBaseProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when the modal should close */
  onClose: () => void
  /** Modal title */
  title?: string
  /** Modal width (columns) */
  width?: number
  /** Modal height (rows) */
  height?: number
  /** Whether to show a border */
  bordered?: boolean
  /** Children content */
  children?: JSX.Element
}

/**
 * Modal header props
 */
export interface ModalHeaderProps {
  /** Header title */
  title: string
  /** Optional subtitle */
  subtitle?: string
  /** Called when close button is clicked */
  onClose?: () => void
  /** Whether to show close button */
  showCloseButton?: boolean
  /** Children content */
  children?: JSX.Element
}

/**
 * Modal content props
 */
export interface ModalContentProps {
  /** Whether to add padding */
  padded?: boolean
  /** Whether content is scrollable */
  scrollable?: boolean
  /** Max height for scrollable content */
  maxHeight?: number
  /** Children content */
  children?: JSX.Element
}

/**
 * Modal footer props
 */
export interface ModalFooterProps {
  /** Alignment of footer content */
  align?: 'left' | 'center' | 'right' | 'space-between'
  /** Children content (typically buttons) */
  children?: JSX.Element
}

/**
 * Confirm modal props
 */
export interface ConfirmModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when confirmed */
  onConfirm: () => void
  /** Called when cancelled */
  onCancel: () => void
  /** Modal title */
  title: string
  /** Confirmation message */
  message: string
  /** Confirm button text */
  confirmText?: string
  /** Cancel button text */
  cancelText?: string
  /** Whether this is a destructive action */
  destructive?: boolean
}

/**
 * Alert modal props
 */
export interface AlertModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when dismissed */
  onDismiss: () => void
  /** Modal title */
  title: string
  /** Alert message */
  message: string
  /** Dismiss button text */
  dismissText?: string
  /** Alert type for styling */
  type?: 'info' | 'success' | 'warning' | 'error'
}
