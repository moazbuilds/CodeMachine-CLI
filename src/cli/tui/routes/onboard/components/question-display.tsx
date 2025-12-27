/** @jsxImportSource @opentui/solid */
/**
 * Question Display Component
 *
 * Shows PO avatar and question text.
 */

import type { Accessor } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface QuestionDisplayProps {
  /** Question text to display */
  question: Accessor<string>
}

export function QuestionDisplay(props: QuestionDisplayProps) {
  const themeCtx = useTheme()

  return (
    <>
      {/* PO Avatar */}
      <box flexDirection="row" gap={2} marginBottom={1}>
        <box
          backgroundColor={themeCtx.theme.backgroundElement}
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={themeCtx.theme.text}>[0.0]</text>
        </box>
        <text fg={themeCtx.theme.textMuted}>PO</text>
      </box>

      {/* Question */}
      <box marginBottom={1}>
        <text fg={themeCtx.theme.text}>
          "{props.question()}"
        </text>
      </box>
    </>
  )
}
