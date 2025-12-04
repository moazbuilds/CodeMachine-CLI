/** @jsxImportSource @opentui/solid */
/**
 * Checkpoint Modal Component
 * Ported from: src/ui/components/CheckpointModal.tsx
 *
 * Full-screen modal that pauses workflow for manual review
 * Shows reason, continue/quit buttons with keyboard navigation
 */

import { createSignal, createMemo, For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { RGBA } from "@opentui/core"
import { useTheme } from "@tui/shared/context/theme"

export interface CheckpointModalProps {
  reason?: string
  onContinue: () => void
  onQuit: () => void
}

export function CheckpointModal(props: CheckpointModalProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [selectedButton, setSelectedButton] = createSignal<"continue" | "quit">("continue")

  // Handle keyboard input
  useKeyboard((evt) => {
    // Arrow key navigation
    if (evt.name === "left" || evt.name === "right") {
      evt.preventDefault()
      setSelectedButton((prev) => (prev === "continue" ? "quit" : "continue"))
      return
    }

    // Enter to confirm
    if (evt.name === "return") {
      evt.preventDefault()
      if (selectedButton() === "continue") {
        props.onContinue()
      } else {
        props.onQuit()
      }
      return
    }

    // Direct shortcuts
    if (evt.name === "c") {
      evt.preventDefault()
      props.onContinue()
      return
    }
    if (evt.name === "q") {
      evt.preventDefault()
      props.onQuit()
      return
    }
  })

  // Calculate modal dimensions
  const safeWidth = () => Math.max(40, (dimensions()?.width ?? 80) - 8)
  const modalWidth = () => Math.min(safeWidth(), 80)

  // Wrap text to fit modal
  const wrapText = (text: string, width: number): string[] => {
    const words = text.split(" ")
    const lines: string[] = []
    let currentLine = ""

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine = currentLine ? `${currentLine} ${word}` : word
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  const wrappedReason = createMemo(() =>
    wrapText(props.reason || "Checkpoint triggered - please review workflow state", modalWidth() - 4)
  )

  const wrappedInfo = createMemo(() =>
    wrapText("Workflow paused - make your changes, then press Continue to resume the session.", modalWidth() - 4)
  )

  const borderChar = "="
  const borderLine = () => borderChar.repeat(modalWidth())
  const separatorLine = () => "-".repeat(modalWidth())

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
          <text fg={themeCtx.theme.primary} attributes={1}>CHECKPOINT - Review Required</text>
        </box>

        {/* Reason */}
        <box paddingTop={1} flexDirection="column">
          <For each={wrappedReason()}>
            {(line) => <text fg={themeCtx.theme.warning}>{line}</text>}
          </For>
        </box>

        {/* Info */}
        <box paddingTop={1} flexDirection="column">
          <For each={wrappedInfo()}>
            {(line) => <text fg={themeCtx.theme.text}>{line}</text>}
          </For>
        </box>

        {/* Separator */}
        <box paddingTop={1}>
          <text fg={themeCtx.theme.textMuted}>{separatorLine()}</text>
        </box>

        {/* Buttons */}
        <box paddingTop={1} gap={4} flexDirection="row">
          <box
            backgroundColor={selectedButton() === "continue" ? themeCtx.theme.success : undefined}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              fg={selectedButton() === "continue" ? themeCtx.theme.background : themeCtx.theme.success}
              attributes={1}
            >
              {selectedButton() === "continue" ? "> " : "  "}[C]ontinue
            </text>
          </box>
          <box
            backgroundColor={selectedButton() === "quit" ? themeCtx.theme.error : undefined}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              fg={selectedButton() === "quit" ? themeCtx.theme.background : themeCtx.theme.error}
            >
              {selectedButton() === "quit" ? "> " : "  "}[Q]uit
            </text>
          </box>
        </box>

        {/* Instructions */}
        <box paddingTop={1}>
          <text fg={themeCtx.theme.textMuted}>
            [Left/Right] Navigate  [ENTER] Confirm  [C/Q] Direct
          </text>
        </box>
      </box>
    </box>
  )
}
