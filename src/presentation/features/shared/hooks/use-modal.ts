/**
 * Use Modal Hook
 *
 * Manages modal visibility state.
 */

import { createSignal } from 'solid-js'
import type { ModalState, ModalStateWithData } from '../types'

/**
 * Create modal state management
 *
 * @example
 * ```typescript
 * const confirmModal = useModal()
 *
 * // Open/close
 * confirmModal.open()
 * confirmModal.close()
 *
 * // In JSX
 * <ConfirmModal isOpen={confirmModal.isOpen} onClose={confirmModal.close} />
 * ```
 */
export function useModal(initialOpen = false): ModalState {
  const [isOpen, setIsOpen] = createSignal(initialOpen)

  return {
    get isOpen() {
      return isOpen()
    },
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  }
}

/**
 * Create modal state with associated data
 *
 * @example
 * ```typescript
 * interface ItemData {
 *   id: string
 *   name: string
 * }
 *
 * const editModal = useModalWithData<ItemData>()
 *
 * // Open with data
 * editModal.openWith({ id: '123', name: 'Test' })
 *
 * // Access data
 * if (editModal.data) {
 *   console.log(editModal.data.name)
 * }
 * ```
 */
export function useModalWithData<T>(initialOpen = false): ModalStateWithData<T> {
  const [isOpen, setIsOpen] = createSignal(initialOpen)
  const [data, setData] = createSignal<T | null>(null)

  return {
    get isOpen() {
      return isOpen()
    },
    get data() {
      return data()
    },
    open: () => setIsOpen(true),
    close: () => {
      setIsOpen(false)
      setData(null)
    },
    toggle: () => setIsOpen((prev) => !prev),
    openWith: (newData: T) => {
      setData(() => newData)
      setIsOpen(true)
    },
  }
}
