/** @jsxImportSource @opentui/solid */
/**
 * Error Boundary Component
 *
 * Fallback UI when an error occurs in the app.
 */

import { createSignal } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"

export interface ErrorComponentProps {
  error: Error
  onExit: () => void
}

export function ErrorComponent(props: ErrorComponentProps) {
  const term = useTerminalDimensions()
  const [copied, setCopied] = createSignal(false)

  const copyError = () => {
    const errorText = `CodeMachine Error:\n\n${props.error.stack || props.error.message}`
    try {
      if (typeof navigator !== "undefined" && "clipboard" in navigator) {
        navigator.clipboard.writeText(errorText).then(() => setCopied(true))
      } else {
        setCopied(true)
      }
    } catch {
      setCopied(true)
    }
  }

  const handleExit = () => {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[2J\x1b[H\x1b[?25h')
    }
    props.onExit()
  }

  return (
    <box flexDirection="column" gap={1} padding={2}>
      <box flexDirection="row" gap={2} alignItems="center">
        <text attributes={1}>Fatal Error Occurred</text>
        <box onMouseUp={copyError} backgroundColor="#565f89" padding={1}>
          <text attributes={1}>Copy Error</text>
        </box>
        {copied() && <text>Copied</text>}
      </box>
      <box flexDirection="row" gap={2}>
        <text>Press Ctrl+C to exit</text>
        <box onMouseUp={handleExit} backgroundColor="#565f89" padding={1}>
          <text>Exit Now</text>
        </box>
      </box>
      <box height={1} />
      <scrollbox height={Math.floor(term().height * 0.7)}>
        <text>{props.error.stack || props.error.message}</text>
      </scrollbox>
    </box>
  )
}
