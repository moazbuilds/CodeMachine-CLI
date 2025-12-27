/** @jsxImportSource @opentui/solid */
/**
 * Question Display Component
 *
 * Shows PO avatar and typing animation for questions.
 */

import type { Accessor } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface QuestionDisplayProps {
  /** Currently typed portion of text */
  typedText: Accessor<string>
  /** Whether typing animation is complete */
  typingDone: Accessor<boolean>
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

      {/* Typing question */}
      <box marginBottom={1}>
        <text fg={themeCtx.theme.text}>
          "{props.typedText()}{props.typingDone() ? "" : "_"}"
        </text>
      </box>
    </>
  )
}
