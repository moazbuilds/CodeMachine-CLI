/** @jsxImportSource solid-js */
import { RGBA } from "@opentui/core"
import { createMemo, createSignal } from "solid-js"
import { createSimpleContext } from "./helper"
import codemachineTheme from "./theme/codemachine.json" with { type: "json" }

export type Theme = {
  primary: RGBA
  secondary: RGBA
  error: RGBA
  warning: RGBA
  success: RGBA
  info: RGBA
  text: RGBA
  textMuted: RGBA
  background: RGBA
  backgroundPanel: RGBA
  backgroundElement: RGBA
  border: RGBA
  borderActive: RGBA
  borderSubtle: RGBA
  mutedBlue: RGBA
  purple: RGBA
}

type HexColor = `#${string}`
type RefName = string
type Variant = {
  dark: HexColor | RefName
  light: HexColor | RefName
}
type ColorValue = HexColor | RefName | Variant | RGBA

type ThemeJson = {
  $schema?: string
  defs?: Record<string, HexColor | RefName>
  theme: Record<keyof Theme, ColorValue>
}

function resolveTheme(theme: ThemeJson, mode: "dark" | "light"): Theme {
  const defs = theme.defs ?? {}

  function resolveColor(c: ColorValue): RGBA {
    if (c instanceof RGBA) return c
    if (typeof c === "string") {
      return c.startsWith("#") ? RGBA.fromHex(c) : resolveColor(defs[c])
    }
    return resolveColor(c[mode])
  }

  return Object.fromEntries(
    Object.entries(theme.theme).map(([key, value]) => {
      return [key, resolveColor(value)]
    }),
  ) as Theme
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { mode: "dark" | "light" }) => {
    // Use signal so theme can be changed dynamically
    const [mode, setMode] = createSignal(props.mode)
    const theme = createMemo(() => resolveTheme(codemachineTheme, mode()))

    return {
      get theme() {
        return theme()
      },
      get mode() {
        return mode()
      },
      setMode,
    }
  },
})
