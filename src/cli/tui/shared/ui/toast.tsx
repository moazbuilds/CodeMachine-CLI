/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { useToast } from "@tui/shared/context/toast"
import { useTheme } from "@tui/shared/context/theme"

const VARIANT_ICONS = {
  success: "✓",
  error: "✗",
  info: "ℹ",
  warning: "▲",
} as const

export function Toast() {
  const toast = useToast()
  const themeCtx = useTheme()

  return (
    <Show when={toast.current}>
      {(currentToast) => (
        <box
          position="absolute"
          top={2}
          right={2}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={themeCtx.theme.backgroundPanel}
          borderColor={themeCtx.theme[currentToast().variant]}
          border={["left", "right"]}
          zIndex={3000}
        >
          <box flexDirection="row" gap={1}>
            <text fg={themeCtx.theme[currentToast().variant]}>
              {VARIANT_ICONS[currentToast().variant]}
            </text>
            <text fg={themeCtx.theme.text}>{currentToast().message}</text>
          </box>
        </box>
      )}
    </Show>
  )
}
