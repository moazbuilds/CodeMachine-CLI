/**
 * Shared tick hook - singleton interval for all timer displays
 */

import { createSignal, onMount, onCleanup } from "solid-js"

let interval: ReturnType<typeof setInterval> | null = null
let subs = 0
const [now, setNow] = createSignal(Date.now())

export function useTick() {
  onMount(() => {
    subs++
    if (!interval) {
      interval = setInterval(() => setNow(Date.now()), 1000)
    }
  })

  onCleanup(() => {
    subs--
    if (subs === 0 && interval) {
      clearInterval(interval)
      interval = null
    }
  })

  return now
}
