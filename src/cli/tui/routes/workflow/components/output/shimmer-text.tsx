/** @jsxImportSource @opentui/solid */
/**
 * Shimmer Text Component
 * Ported from: src/ui/components/ShimmerText.tsx
 *
 * Animated shimmer text with wave effect using OpenTUI's useTimeline
 */

import { RGBA } from "@opentui/core"
import { useTimeline } from "@opentui/solid"
import { createSignal } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"

export interface ShimmerTextProps {
  text: string
  color?: RGBA
}

const DURATION = 2_500

export function ShimmerText(props: ShimmerTextProps) {
  const themeCtx = useTheme()

  const timeline = useTimeline({
    duration: DURATION,
    loop: true,
  })

  const characters = props.text.split("")

  // Use provided color or default to theme text color (gray)
  const color = props.color ?? RGBA.fromInts(128, 128, 128, 255)

  const shimmerSignals = characters.map((_, i) => {
    const [shimmer, setShimmer] = createSignal(0.4)
    const target = {
      shimmer: shimmer(),
      setShimmer,
    }

    timeline!.add(
      target,
      {
        shimmer: 1,
        duration: DURATION / (props.text.length + 1),
        ease: "linear",
        alternate: true,
        loop: 2,
        onUpdate: () => {
          target.setShimmer(target.shimmer)
        },
      },
      (i * (DURATION / (props.text.length + 1))) / 2
    )

    return shimmer
  })

  return (
    <text>
      {(() => {
        return characters.map((ch, i) => {
          const shimmer = shimmerSignals[i]
          const fg = RGBA.fromInts(color.r * 255, color.g * 255, color.b * 255, shimmer() * 255)
          return <span style={{ fg }}>{ch}</span>
        })
      })()}
    </text>
  )
}
