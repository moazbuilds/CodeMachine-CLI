/** @jsxImportSource @opentui/solid */
import type { JSX } from "solid-js"
import { RGBA } from "@opentui/core"
import { useTheme } from "@tui/shared/context/theme"
import { useTerminalDimensions } from "@opentui/solid"

export interface DialogWrapperProps {
  children: JSX.Element
}

export function DialogWrapper(props: DialogWrapperProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()

  // Full-screen backdrop with dark semi-transparent overlay (dimming effect)
  const backdropOverlay = RGBA.fromInts(0, 0, 0, 144) // ~56% opacity black overlay

  // Safe dimension getters with fallbacks
  const safeWidth = () => {
    const w = dimensions()?.width ?? 80
    return isFinite(w) && w > 0 ? w : 80
  }

  const safeHeight = () => {
    const h = dimensions()?.height ?? 24
    return isFinite(h) && h > 0 ? h : 24
  }

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={safeWidth()}
      height={safeHeight()}
      backgroundColor={backdropOverlay}
      alignItems="center"
      justifyContent="center"
      zIndex={2000}
    >
      <box
        maxWidth={Math.min(70, Math.max(10, safeWidth() - 4))}
        maxHeight={Math.max(10, safeHeight() - 6)}
        backgroundColor={themeCtx.theme.background}
        borderColor={themeCtx.theme.border}
        border={["top", "bottom", "left", "right"]}
        borderStyle="rounded"
        padding={2}
      >
        {props.children}
      </box>
    </box>
  )
}
