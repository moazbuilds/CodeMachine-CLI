/** @jsxImportSource @opentui/solid */
/**
 * Narrator View
 *
 * Main view for the narrator TUI.
 * Displays Ali frame centered on screen with keyboard controls.
 *
 * Controls:
 * - 'r' to repeat/restart
 * - Ctrl+C to exit
 */

import { Show } from 'solid-js'
import { useKeyboard, useTerminalDimensions } from '@opentui/solid'
import { AliFrame } from './components/ali-frame.js'
import { NarratorText } from './components/narrator-text.js'
import { useNarratorPlayback } from './hooks/use-narrator-playback.js'
import type { NarratorScript } from './parser/types.js'

// Expression mappings - cool swagger-style faces
const EXPRESSIONS: Record<string, string> = {
  idle: '(⌐■_■)',
  thinking: '(╭ರ_•́)',
  tool: '<(•_•<)',
  error: '(╥﹏╥)',
  excited: '(ノ◕ヮ◕)ノ',
  cool: '(⌐■_■)',
}

export interface NarratorViewProps {
  /** Script to play */
  script: NarratorScript
  /** Typing speed in ms per character */
  speed?: number
  /** Callback when narrator exits */
  onExit: () => void
}

/**
 * Main narrator view component
 */
export function NarratorView(props: NarratorViewProps) {
  const dimensions = useTerminalDimensions()

  const playback = useNarratorPlayback({
    script: props.script,
    onExit: props.onExit,
  })

  // Handle keyboard input
  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === 'c') {
      evt.preventDefault()
      playback.exit()
    } else if (evt.name === 'r') {
      evt.preventDefault()
      playback.restart()
    }
  })

  // Get face character for current expression
  const faceChar = () => {
    const expr = playback.currentFace()
    return EXPRESSIONS[expr] ?? EXPRESSIONS.idle ?? '(o_o)'
  }

  // Handle inline face changes from text
  const handleFaceChange = (expression: string) => {
    playback.setFace(expression)
  }

  // Calculate max text length across ALL lines for fixed frame width
  const maxTextLength = () => {
    let maxLen = 0
    for (const line of props.script.lines) {
      const lineLen = line.segments
        .filter((seg): seg is { type: 'text'; content: string } => seg.type === 'text')
        .reduce((len, seg) => len + seg.content.length, 0)
      if (lineLen > maxLen) maxLen = lineLen
    }
    return maxLen
  }

  // Fixed frame width: border + arrow + text + padding.
  // Clamp to terminal width so centered layout never overflows/crops.
  const frameWidth = () => {
    const terminalWidth = dimensions()?.width ?? 80
    const desiredWidth = Math.max(40, maxTextLength() + 10)
    const maxAllowedWidth = Math.max(10, terminalWidth - 2)
    return Math.min(desiredWidth, maxAllowedWidth)
  }

  // Calculate vertical centering
  const topPadding = () => Math.max(0, Math.floor(((dimensions()?.height ?? 24) - 6) / 2))

  return (
    <box
      width={dimensions()?.width ?? 80}
      height={dimensions()?.height ?? 24}
      flexDirection="column"
      alignItems="center"
    >
      {/* Vertical spacer for centering */}
      <box height={topPadding()} />

      {/* Ali frame with content */}
      <Show when={playback.currentLine()}>
        {(line) => (
          <AliFrame face={faceChar()} width={frameWidth()}>
            <NarratorText
              segments={line().segments}
              speed={props.speed}
              onFaceChange={handleFaceChange}
              onComplete={playback.onLineComplete}
              restartKey={playback.restartKey()}
            />
          </AliFrame>
        )}
      </Show>

    </box>
  )
}
