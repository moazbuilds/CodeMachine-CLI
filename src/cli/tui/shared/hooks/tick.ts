/**
 * Shared tick hook - singleton interval for all timer displays
 *
 * Creates a local signal per component that syncs with a shared interval.
 * This ensures SolidJS reactivity works correctly since module-level
 * signals may not trigger re-renders in all components.
 */

import { createSignal, onMount, onCleanup } from "solid-js"

let interval: ReturnType<typeof setInterval> | null = null
let subs = 0
let currentTime = Date.now()
const listeners = new Set<() => void>()

function tick() {
  currentTime = Date.now()
  listeners.forEach((l) => l())
}

export function useTick() {
  const [localNow, setLocalNow] = createSignal(currentTime)

  const update = () => setLocalNow(currentTime)

  onMount(() => {
    subs++
    listeners.add(update)
    if (!interval) {
      interval = setInterval(tick, 1000)
    }
    // Immediately sync current time
    update()
  })

  onCleanup(() => {
    listeners.delete(update)
    subs--
    if (subs === 0 && interval) {
      clearInterval(interval)
      interval = null
    }
  })

  return localNow
}
