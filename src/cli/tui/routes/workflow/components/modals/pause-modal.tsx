/** @jsxImportSource @opentui/solid */
/**
 * Pause Modal Component
 *
 * Modal shown when workflow is paused, allowing user to
 * enter a custom prompt to steer the agent on resume.
 */

import { createSignal } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { RGBA } from "@opentui/core"
import { useTheme } from "@tui/shared/context/theme"

export interface PauseModalProps {
  onResume: (prompt?: string) => void
  onCancel: () => void
}

export function PauseModal(props: PauseModalProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [input, setInput] = createSignal("")

  // Handle keyboard input
  useKeyboard((evt) => {
    // Escape to cancel
    if (evt.name === "escape") {
      evt.preventDefault()
      props.onCancel()
      return
    }
  })

  const handleSubmit = () => {
    const value = input().trim()
    // Pass undefined if empty to use default prompt
    props.onResume(value || undefined)
  }

  const handleKeyDown = (evt: { name?: string }) => {
    if (evt.name === "return") {
      handleSubmit()
    }
  }

  // Calculate modal dimensions
  const safeWidth = () => Math.max(50, (dimensions()?.width ?? 80) - 8)
  const modalWidth = () => Math.min(safeWidth(), 80)

  // Full-screen backdrop
  const backdropOverlay = RGBA.fromInts(0, 0, 0, 144)

  const safeHeight = () => {
    const h = dimensions()?.height ?? 24
    return isFinite(h) && h > 0 ? h : 24
  }

  const termWidth = () => dimensions()?.width ?? 80

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={termWidth()}
      height={safeHeight()}
      backgroundColor={backdropOverlay}
      alignItems="center"
      justifyContent="center"
      zIndex={2000}
    >
      {/* Centered modal box */}
      <box
        flexDirection="column"
        backgroundColor={themeCtx.theme.background}
        borderColor={themeCtx.theme.primary}
        border={["top", "bottom", "left", "right"]}
        borderStyle="rounded"
        padding={2}
        maxWidth={Math.min(modalWidth(), termWidth() - 4)}
      >
        {/* Title */}
        <box>
          <text fg={themeCtx.theme.warning} attributes={1}>{"#  "}</text>
          <text fg={themeCtx.theme.primary} attributes={1}>PAUSED - Steer Agent</text>
        </box>

        {/* Info */}
        <box paddingTop={1}>
          <text fg={themeCtx.theme.text}>
            Enter a message to guide the agent, or press Enter for default.
          </text>
        </box>

        {/* Input field */}
        <box
          paddingTop={1}
          borderColor={themeCtx.theme.border}
          border={["top", "bottom", "left", "right"]}
          borderStyle="rounded"
          paddingLeft={1}
          paddingRight={1}
        >
          <input
            value={input()}
            placeholder="Continue from where you left off..."
            onInput={setInput}
            onKeyDown={handleKeyDown}
            focused={true}
            backgroundColor="transparent"
            focusedBackgroundColor="transparent"
          />
        </box>

        {/* Separator */}
        <box paddingTop={1}>
          <text fg={themeCtx.theme.textMuted}>{"-".repeat(modalWidth() - 4)}</text>
        </box>

        {/* Instructions */}
        <box paddingTop={1}>
          <text fg={themeCtx.theme.textMuted}>
            [ENTER] Resume  [ESC] Cancel
          </text>
        </box>
      </box>
    </box>
  )
}
