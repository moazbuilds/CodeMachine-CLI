/** @jsxImportSource @opentui/solid */
import { createSignal, onMount, JSX } from "solid-js"
import { useTimeline } from "@opentui/solid"

interface FadeInProps {
  children: JSX.Element
  delay?: number
  duration?: number
}

export function FadeIn(props: FadeInProps) {
  const [opacity, setOpacity] = createSignal(0)
  const delay = props.delay ?? 0
  const duration = props.duration ?? 800

  const timeline = useTimeline({ autoplay: true })
  const target = { opacity: 0 }

  onMount(() => {
    timeline.add(
      target,
      {
        duration,
        opacity: 1,
        ease: "outQuad",
        onUpdate: () => setOpacity(target.opacity),
      },
      delay
    )
  })

  // @ts-expect-error - opacity is a valid box property in OpenTUI
  return <box opacity={opacity()} flexGrow={1}>{props.children}</box>
}
