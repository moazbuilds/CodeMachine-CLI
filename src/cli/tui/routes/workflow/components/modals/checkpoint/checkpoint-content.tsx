/** @jsxImportSource @opentui/solid */
/**
 * Checkpoint Content Component
 *
 * Displays checkpoint reason and info text.
 */

import { createMemo, For } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { wrapText } from "@tui/shared/utils"

export interface CheckpointContentProps {
  reason?: string
  modalWidth: number
}

export function CheckpointContent(props: CheckpointContentProps) {
  const themeCtx = useTheme()

  const wrappedReason = createMemo(() =>
    wrapText(props.reason || "Checkpoint triggered - please review workflow state", props.modalWidth - 4)
  )

  const wrappedInfo = createMemo(() =>
    wrapText("Workflow paused - make your changes, then press Continue to resume the session.", props.modalWidth - 4)
  )

  const separatorLine = () => "-".repeat(props.modalWidth)

  return (
    <>
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
    </>
  )
}
