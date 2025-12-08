/** @jsxImportSource @opentui/solid */
/**
 * Modal Base Component
 *
 * Reusable base modal with backdrop, centered content, and keyboard handling.
 * Provides consistent modal styling across the application.
 */

import type { JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { RGBA } from "@opentui/core"
import { useTheme } from "@tui/shared/context/theme"

export interface ModalBaseProps {
  children: JSX.Element
  width?: number
  maxWidth?: number
  zIndex?: number
  onClose?: () => void
}

/** Semi-transparent backdrop overlay */
const BACKDROP_OVERLAY = RGBA.fromInts(0, 0, 0, 144)

export function ModalBase(props: ModalBaseProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()

  const termWidth = () => dimensions()?.width ?? 80
  const termHeight = () => {
    const h = dimensions()?.height ?? 24
    return isFinite(h) && h > 0 ? h : 24
  }

  const modalWidth = () => {
    const maxW = props.maxWidth ?? 80
    const preferred = props.width ?? maxW
    return Math.min(preferred, termWidth() - 4)
  }

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={termWidth()}
      height={termHeight()}
      backgroundColor={BACKDROP_OVERLAY}
      alignItems="center"
      justifyContent="center"
      zIndex={props.zIndex ?? 2000}
    >
      <box
        flexDirection="column"
        backgroundColor={themeCtx.theme.background}
        borderColor={themeCtx.theme.primary}
        border={["top", "bottom", "left", "right"]}
        borderStyle="rounded"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        width={modalWidth()}
      >
        {props.children}
      </box>
    </box>
  )
}
