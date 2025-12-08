/** @jsxImportSource @opentui/solid */
/**
 * Onboard View
 *
 * Pre-workflow onboarding flow: track selection, spec writing with PO, etc.
 */

import { createSignal, For, onMount } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import type { TrackConfig } from "../../../../workflows/templates/types"

export interface OnboardProps {
  tracks: Record<string, TrackConfig>
  onComplete: (trackId: string) => void
  onCancel?: () => void
}

export function Onboard(props: OnboardProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [typedText, setTypedText] = createSignal("")
  const [typingDone, setTypingDone] = createSignal(false)

  const question = "What is your project size?"
  const trackEntries = () => Object.entries(props.tracks)

  // Typing effect
  onMount(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i <= question.length) {
        setTypedText(question.slice(0, i))
        i++
      } else {
        setTypingDone(true)
        clearInterval(interval)
      }
    }, 50)
  })

  useKeyboard((evt) => {
    if (evt.name === "up") {
      evt.preventDefault()
      setSelectedIndex((prev) => Math.max(0, prev - 1))
    } else if (evt.name === "down") {
      evt.preventDefault()
      setSelectedIndex((prev) => Math.min(trackEntries().length - 1, prev + 1))
    } else if (evt.name === "return") {
      evt.preventDefault()
      const [trackId] = trackEntries()[selectedIndex()]
      props.onComplete(trackId)
    } else if (evt.name === "escape") {
      evt.preventDefault()
      props.onCancel?.()
    } else if (evt.name && /^[1-9]$/.test(evt.name)) {
      const num = parseInt(evt.name, 10)
      if (num >= 1 && num <= trackEntries().length) {
        evt.preventDefault()
        const [trackId] = trackEntries()[num - 1]
        props.onComplete(trackId)
      }
    }
  })

  const termWidth = () => dimensions()?.width ?? 80
  const termHeight = () => dimensions()?.height ?? 24

  return (
    <box
      width={termWidth()}
      height={termHeight()}
      backgroundColor={themeCtx.theme.background}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <box
        flexDirection="column"
        width={Math.min(60, termWidth() - 4)}
        backgroundColor={themeCtx.theme.backgroundPanel}
        borderColor={themeCtx.theme.primary}
        border={["top", "bottom", "left", "right"]}
        borderStyle="rounded"
        paddingLeft={3}
        paddingRight={3}
        paddingTop={2}
        paddingBottom={2}
        gap={1}
      >
        {/* PO Avatar */}
        <box flexDirection="row" gap={2} marginBottom={1}>
          <box
            backgroundColor={themeCtx.theme.backgroundElement}
            paddingLeft={1}
            paddingRight={1}
          >
            <text fg={themeCtx.theme.text}>[0.0]</text>
          </box>
          <text fg={themeCtx.theme.textMuted}>PO</text>
        </box>

        {/* Typing question */}
        <box marginBottom={1}>
          <text fg={themeCtx.theme.text}>
            "{typedText()}{typingDone() ? "" : "_"}"
          </text>
        </box>

        {/* Track options */}
        <box flexDirection="column" gap={1} marginTop={1}>
          <For each={trackEntries()}>
            {([trackId, config], index) => {
              const isSelected = () => index() === selectedIndex()
              return (
                <box flexDirection="column">
                  <box flexDirection="row" gap={1}>
                    <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                      {isSelected() ? ">" : " "}
                    </text>
                    <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                      {isSelected() ? "[x]" : "[ ]"}
                    </text>
                    <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.text}>
                      {config.label}
                    </text>
                  </box>
                  {config.description && (
                    <box marginLeft={6}>
                      <text fg={themeCtx.theme.textMuted}>{config.description}</text>
                    </box>
                  )}
                </box>
              )
            }}
          </For>
        </box>

        {/* Footer */}
        <box marginTop={2}>
          <text fg={themeCtx.theme.textMuted}>
            [Up/Down] Navigate  [Enter] Select  [Esc] Cancel
          </text>
        </box>
      </box>
    </box>
  )
}
