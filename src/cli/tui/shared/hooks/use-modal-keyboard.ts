/**
 * Modal Keyboard Hook
 *
 * Provides common keyboard handling for modals including
 * close on Escape and scroll navigation.
 */

import { useKeyboard } from "@opentui/solid"

export interface UseModalKeyboardOptions {
  onClose?: () => void
  onScrollUp?: () => void
  onScrollDown?: () => void
  onPageUp?: () => void
  onPageDown?: () => void
  onGoTop?: () => void
  onGoBottom?: () => void
  onSelect?: () => void
  disabled?: boolean
}

/**
 * Hook for common modal keyboard handling
 */
export function useModalKeyboard(options: UseModalKeyboardOptions) {
  useKeyboard((evt) => {
    if (options.disabled) return

    // Escape to close
    if (evt.name === "escape" && options.onClose) {
      evt.preventDefault()
      options.onClose()
      return
    }

    // Arrow up - scroll up
    if (evt.name === "up" && options.onScrollUp) {
      evt.preventDefault()
      options.onScrollUp()
      return
    }

    // Arrow down - scroll down
    if (evt.name === "down" && options.onScrollDown) {
      evt.preventDefault()
      options.onScrollDown()
      return
    }

    // Page up
    if (evt.name === "pageup" && options.onPageUp) {
      evt.preventDefault()
      options.onPageUp()
      return
    }

    // Page down
    if (evt.name === "pagedown" && options.onPageDown) {
      evt.preventDefault()
      options.onPageDown()
      return
    }

    // g - go to top (vim-style)
    if (evt.name === "g" && !evt.shift && options.onGoTop) {
      evt.preventDefault()
      options.onGoTop()
      return
    }

    // G (shift+g) - go to bottom (vim-style)
    if (evt.shift && evt.name === "g" && options.onGoBottom) {
      evt.preventDefault()
      options.onGoBottom()
      return
    }

    // Enter - select
    if (evt.name === "return" && options.onSelect) {
      evt.preventDefault()
      options.onSelect()
      return
    }
  })
}
