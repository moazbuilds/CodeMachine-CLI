/**
 * Narrator Playback Hook
 *
 * State machine for narrator playback:
 * IDLE -> PLAYING -> LINE_COMPLETE -> (next line or WAITING)
 *                                           |
 *                          'r' pressed -> PLAYING (restart)
 *                          Ctrl+C -> EXIT
 */

import { createSignal, createEffect, on } from 'solid-js'
import type { NarratorScript, ScriptLine } from '../parser/types.js'

export type PlaybackState = 'idle' | 'playing' | 'line_complete' | 'waiting' | 'exit'

export interface UseNarratorPlaybackOptions {
  /** The script to play */
  script: NarratorScript
  /** Callback when playback exits */
  onExit?: () => void
}

export interface UseNarratorPlaybackReturn {
  /** Current playback state */
  state: () => PlaybackState
  /** Current line index */
  lineIndex: () => number
  /** Current line */
  currentLine: () => ScriptLine | null
  /** Current face expression */
  currentFace: () => string
  /** Set face expression (for inline face changes) */
  setFace: (face: string) => void
  /** Called when line typing completes */
  onLineComplete: () => void
  /** Restart playback from beginning */
  restart: () => void
  /** Exit playback */
  exit: () => void
  /** Restart key for NarratorText component */
  restartKey: () => number
}

export function useNarratorPlayback(options: UseNarratorPlaybackOptions): UseNarratorPlaybackReturn {
  const { script, onExit } = options

  const [state, setState] = createSignal<PlaybackState>('idle')
  const [lineIndex, setLineIndex] = createSignal(0)
  const [currentFace, setCurrentFace] = createSignal('idle')
  const [restartKey, setRestartKey] = createSignal(0)

  // Get current line
  const currentLine = () => {
    const idx = lineIndex()
    if (idx >= script.lines.length) return null
    return script.lines[idx]
  }

  // Start playback on mount
  createEffect(
    on(
      () => restartKey(),
      () => {
        const line = currentLine()
        if (line) {
          setCurrentFace(line.initialFace)
          setState('playing')
        }
      }
    )
  )

  // Handle line complete -> wait endDelay -> next line or waiting
  const onLineComplete = () => {
    setState('line_complete')
    const line = currentLine()
    const delayMs = (line?.endDelay ?? 2) * 1000

    setTimeout(() => {
      const nextIndex = lineIndex() + 1
      if (nextIndex >= script.lines.length) {
        // Script complete, wait for restart or exit
        setState('waiting')
      } else {
        // Move to next line
        setLineIndex(nextIndex)
        const nextLine = script.lines[nextIndex]
        if (nextLine) {
          setCurrentFace(nextLine.initialFace)
        }
        setRestartKey((k) => k + 1)
        setState('playing')
      }
    }, delayMs)
  }

  // Restart from beginning
  const restart = () => {
    setLineIndex(0)
    const firstLine = script.lines[0]
    if (firstLine) {
      setCurrentFace(firstLine.initialFace)
    }
    setRestartKey((k) => k + 1)
    setState('playing')
  }

  // Exit playback
  const exit = () => {
    setState('exit')
    onExit?.()
  }

  return {
    state,
    lineIndex,
    currentLine,
    currentFace,
    setFace: setCurrentFace,
    onLineComplete,
    restart,
    exit,
    restartKey,
  }
}
