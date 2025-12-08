/** @jsxImportSource @opentui/solid */
/**
 * Modal Content Component
 *
 * Wrapper for modal body content with optional padding.
 */

import type { JSX } from "solid-js"

export interface ModalContentProps {
  children: JSX.Element
  paddingTop?: number
}

export function ModalContent(props: ModalContentProps) {
  return (
    <box flexDirection="column" paddingTop={props.paddingTop ?? 1}>
      {props.children}
    </box>
  )
}
