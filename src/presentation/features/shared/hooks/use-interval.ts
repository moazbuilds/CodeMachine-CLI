/**
 * Use Interval Hook
 *
 * Manages setInterval with automatic cleanup.
 */

import { createSignal, onMount, onCleanup } from 'solid-js'

/**
 * Options for interval hook
 */
export interface UseIntervalOptions {
  /** Callback to run on each interval */
  callback: () => void
  /** Interval duration in milliseconds */
  delay: number
  /** Whether to start immediately */
  immediate?: boolean
  /** Whether the interval is enabled */
  enabled?: boolean
}

/**
 * Interval state
 */
export interface IntervalState {
  /** Whether the interval is running */
  isRunning: boolean
  /** Start the interval */
  start: () => void
  /** Stop the interval */
  stop: () => void
  /** Reset and restart the interval */
  reset: () => void
}

/**
 * Create a managed interval
 *
 * @example
 * ```typescript
 * const timer = useInterval({
 *   callback: () => setSeconds(s => s + 1),
 *   delay: 1000,
 *   immediate: true,
 * })
 *
 * // Later
 * timer.stop()
 * timer.start()
 * ```
 */
export function useInterval(options: UseIntervalOptions): IntervalState {
  const [isRunning, setIsRunning] = createSignal(false)
  let intervalId: ReturnType<typeof setInterval> | null = null

  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
      setIsRunning(false)
    }
  }

  const start = () => {
    if (intervalId !== null) return // Already running

    intervalId = setInterval(options.callback, options.delay)
    setIsRunning(true)
  }

  const reset = () => {
    stop()
    start()
  }

  onMount(() => {
    const enabled = options.enabled ?? true
    const immediate = options.immediate ?? false

    if (enabled && immediate) {
      start()
    }
  })

  onCleanup(stop)

  return {
    get isRunning() {
      return isRunning()
    },
    start,
    stop,
    reset,
  }
}

/**
 * Simple tick hook that calls a function at regular intervals
 *
 * @example
 * ```typescript
 * // Update every second
 * useTick(() => setTime(Date.now()), 1000)
 * ```
 */
export function useTick(callback: () => void, delay: number): void {
  useInterval({
    callback,
    delay,
    immediate: true,
    enabled: true,
  })
}
