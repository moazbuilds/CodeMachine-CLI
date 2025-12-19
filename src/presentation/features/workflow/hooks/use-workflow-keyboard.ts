/**
 * Use Workflow Keyboard Hook
 *
 * Manages keyboard shortcuts for the workflow screen.
 */

import {
  useNavigationKeys,
  useActionKeys,
  useGlobalShortcuts,
  useModalKeys,
} from '../../../hooks/keyboard'
import type { WorkflowScreenActions, WorkflowModals } from '../types'

/**
 * Options for workflow keyboard hook
 */
export interface UseWorkflowKeyboardOptions {
  /** Workflow actions */
  actions: WorkflowScreenActions
  /** Current modal state */
  modals: WorkflowModals
  /** Whether input is focused */
  isInputFocused: boolean
  /** Navigate timeline items */
  navigateTimeline: {
    movePrevious: () => void
    moveNext: () => void
  }
  /** Active panel */
  activePanel: 'timeline' | 'output'
}

/**
 * Check if any modal is open
 */
function isAnyModalOpen(modals: WorkflowModals): boolean {
  return Object.values(modals).some((v) => v)
}

/**
 * Set up keyboard handlers for workflow screen
 *
 * @example
 * ```typescript
 * useWorkflowKeyboard({
 *   actions,
 *   modals: state.modals,
 *   isInputFocused: state.inputActive,
 *   navigateTimeline: {
 *     movePrevious: () => nav.movePrevious(),
 *     moveNext: () => nav.moveNext(),
 *   },
 *   activePanel: state.panels.activePanel,
 * })
 * ```
 */
export function useWorkflowKeyboard(
  options: UseWorkflowKeyboardOptions
): (() => void)[] {
  const unsubscribes: (() => void)[] = []

  const isModalOpen = () => isAnyModalOpen(options.modals)

  // Global shortcuts (always active)
  unsubscribes.push(
    ...useGlobalShortcuts({
      handlers: {
        onShiftTab: () => {
          if (!isModalOpen()) {
            options.actions.toggleMode()
          }
        },
        onTab: () => {
          if (!isModalOpen() && !options.isInputFocused) {
            const nextPanel =
              options.activePanel === 'timeline' ? 'output' : 'timeline'
            options.actions.switchPanel(nextPanel)
          }
        },
        onCtrlS: () => {
          if (!isModalOpen()) {
            options.actions.skipStep()
          }
        },
        onCtrlC: () => {
          if (!isModalOpen()) {
            options.actions.openModal('stopModal')
          }
        },
        onCtrlP: () => {
          if (!isModalOpen()) {
            options.actions.pauseWorkflow()
          }
        },
        onCtrlH: () => {
          if (!isModalOpen()) {
            options.actions.openModal('historyModal')
          }
        },
      },
    })
  )

  // Navigation keys (for timeline)
  unsubscribes.push(
    ...useNavigationKeys({
      actions: {
        navigateUp: options.navigateTimeline.movePrevious,
        navigateDown: options.navigateTimeline.moveNext,
      },
      enabled: () =>
        !isModalOpen() &&
        !options.isInputFocused &&
        options.activePanel === 'timeline',
    })
  )

  // Action keys (Enter to expand, Escape to close modals)
  unsubscribes.push(
    ...useActionKeys({
      handlers: {
        onEnter: () => {
          if (options.isInputFocused) {
            options.actions.submitInput()
          }
        },
        onEscape: () => {
          // Close any open modal
          const modalKeys = Object.keys(options.modals) as (keyof WorkflowModals)[]
          const openModal = modalKeys.find((key) => options.modals[key])
          if (openModal) {
            options.actions.closeModal(openModal)
          }
        },
      },
      enabled: () => true,
    })
  )

  // Modal-specific keys (when stop modal is open)
  unsubscribes.push(
    ...useModalKeys({
      handlers: {
        onClose: () => options.actions.closeModal('stopModal'),
        onConfirm: () => options.actions.stopWorkflow(),
        onYes: () => options.actions.stopWorkflow(),
        onNo: () => options.actions.closeModal('stopModal'),
      },
      isOpen: () => options.modals.stopModal,
    })
  )

  return unsubscribes
}
