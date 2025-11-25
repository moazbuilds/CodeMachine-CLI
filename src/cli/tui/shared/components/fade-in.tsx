/** @jsxImportSource @opentui/solid */
import { createSignal, onMount, onCleanup, JSX, children as resolveChildren } from "solid-js"

interface FadeInProps {
  children: JSX.Element
  delay?: number
  duration?: number
}

export function FadeIn(props: FadeInProps) {
  const [opacity, setOpacity] = createSignal(0)
  const delay = props.delay ?? 0
  const duration = props.duration ?? 800
  const resolved = resolveChildren(() => props.children)

  onMount(() => {
    const startTime = Date.now() + delay

    const animate = () => {
      const now = Date.now()
      if (now < startTime) {
        requestAnimationFrame(animate)
        return
      }

      const progress = Math.min(1, (now - startTime) / duration)
      setOpacity(progress)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    const animationFrame = requestAnimationFrame(animate)
    onCleanup(() => cancelAnimationFrame(animationFrame))
  })

  // Apply opacity directly to child element instead of wrapping
  const child = resolved()
  if (child && typeof child === 'object' && 'type' in child) {
    // @ts-expect-error - opacity is a valid box property in OpenTUI
    return <box opacity={opacity()} flexGrow={1}>{child}</box>
  }

  // @ts-expect-error - opacity is a valid box property in OpenTUI
  return <box opacity={opacity()} flexGrow={1}>{props.children}</box>
}
