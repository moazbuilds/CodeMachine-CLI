/** @jsxImportSource @opentui/solid */
/**
 * Animated Spinner Component
 * Simple moon phase spinner
 */

import { createSignal, onMount, onCleanup } from "solid-js"
import type { RGBA } from "@opentui/core"

// Moon phases - 4 frame rotation
const FRAMES = ["◐", "◓", "◑", "◒"]

interface SpinnerProps {
  color?: RGBA
  interval?: number // default 100ms
}

export function Spinner(props: SpinnerProps) {
  const [frame, setFrame] = createSignal(0)

  onMount(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, props.interval ?? 100)
    onCleanup(() => clearInterval(id))
  })

  return <text fg={props.color}>{FRAMES[frame()]}</text>
}
