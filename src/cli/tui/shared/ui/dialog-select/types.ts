/**
 * DialogSelect Types
 */

import type { JSX } from "solid-js"

export interface DialogSelectOption<T = unknown> {
  value: T
  title: string
  description?: string
  category?: string
  footer?: string | JSX.Element
  gutter?: JSX.Element
  disabled?: boolean
  onSelect?: () => void
}

export interface DialogSelectKeybind<T = unknown> {
  keybind: {
    key: string
    ctrl?: boolean
    meta?: boolean
    shift?: boolean
  }
  title: string
  disabled?: boolean
  onTrigger: (option: DialogSelectOption<T>) => void
}

export interface DialogSelectProps<T = unknown> {
  title: string
  options: DialogSelectOption<T>[]
  current?: T
  placeholder?: string
  skipFilter?: boolean
  keybind?: DialogSelectKeybind<T>[]
  onSelect?: (value: T) => void
  onCancel?: () => void
  onFilter?: (query: string) => void
  onMove?: (option: DialogSelectOption<T>) => void
  ref?: (ref: DialogSelectRef<T>) => void
}

export interface DialogSelectRef<T = unknown> {
  selectedIndex: () => number
  setSelectedIndex: (index: number) => void
  getSelectedOption: () => DialogSelectOption<T> | undefined
}

export interface GroupedOptions<T> {
  category: string | null
  options: DialogSelectOption<T>[]
}
