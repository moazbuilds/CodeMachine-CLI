/** @jsxImportSource @opentui/solid */
import { TextAttributes, RGBA } from "@opentui/core"
import { For, Show, createSignal, type JSX } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useTerminalDimensions } from "@opentui/solid"

// Base CODE_TEXT frames for animation (single arrow moving down)
const CODE_TEXT_FRAMES = [
  // Frame 0: arrow at top position
  [
    '   ██████╗ ██████╗ ██████╗ ███████╗',
    '  ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
    '  ██║     ██║   ██║██║↓ ██║█████╗  ',
    '  ██║     ██║   ██║██║  ██║██╔══╝  ',
    '  ╚██████╗╚██████╔╝██████╔╝███████╗',
    '   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
  ],
  // Frame 1: arrow at middle position
  [
    '   ██████╗ ██████╗ ██████╗ ███████╗',
    '  ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
    '  ██║     ██║   ██║██║  ██║█████╗  ',
    '  ██║     ██║   ██║██║↓ ██║██╔══╝  ',
    '  ╚██████╗╚██████╔╝██████╔╝███████╗',
    '   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
  ],
  // Frame 2: arrow at bottom (fade out)
  [
    '   ██████╗ ██████╗ ██████╗ ███████╗',
    '  ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
    '  ██║     ██║   ██║██║  ██║█████╗  ',
    '  ██║     ██║   ██║██║  ██║██╔══╝  ',
    '  ╚██████╗╚██████╔╝██████╔╝███████╗',
    '   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
  ],
]

const MACHINE_TEXT = [
  '  ███╗   ███╗ █████╗  ██████╗██╗  ██╗██╗███╗   ██╗███████╗',
  '  ████╗ ████║██╔══██╗██╔════╝██║  ██║██║████╗  ██║██╔════╝',
  '  ██╔████╔██║███████║██║     ███████║██║██╔██╗ ██║█████╗  ',
  '  ██║╚██╔╝██║██╔══██║██║     ██╔══██║██║██║╚██╗██║██╔══╝  ',
  '  ██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║██║██║ ╚████║███████╗',
  '  ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝',
  '     >->__                  >>----------------------->    '
]

const SIMPLE_TEXT = [
  '█▀▀ █▀█ █▀▄ █▀▀ █▀▄▀█ ▄▀█ █▀▀ █ █ █ █▄ █ █▀▀',
  '█▄▄ █▄█ █▄▀ ██▄ █ ▀ █ █▀█ █▄▄ █▀█ █ █ ▀█ ██▄'
]

// Helper to render a line with two-tone coloring using spans
function ColoredLine(props: { line: string; blockColor: () => RGBA; borderColor: () => RGBA; bold?: boolean }) {
  // Build segments reactively using a function
  const segments = () => {
    const result: JSX.Element[] = []
    let currentSegment = ''
    let currentType: 'block' | 'border' | null = null

    const finishSegment = () => {
      if (currentSegment) {
        const color = currentType === 'block' ? props.blockColor() : props.borderColor()
        result.push(<span style={{ fg: color }}>{currentSegment}</span>)
        currentSegment = ''
      }
    }

    for (const char of props.line) {
      const isBlock = char === '█'
      const isBorder = '╔═╗║╚╝╠╣╦╩╬'.includes(char)
      const charType = isBlock ? 'block' : isBorder ? 'border' : null

      if (charType !== currentType) {
        finishSegment()
        currentType = charType
      }

      currentSegment += char
    }

    finishSegment()
    return result
  }

  return (
    <box>
      <text attributes={props.bold ? TextAttributes.BOLD : 0}>
        {segments()}
      </text>
    </box>
  )
}

export function Logo() {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()

  // Animation state for arrow movement
  // TEMPORARY: Animation disabled to reduce debug logging
  const [currentFrame] = createSignal(0)

  // Cycle through frames every 400ms
  // const intervalId = setInterval(() => {
  //   setCurrentFrame((prev) => (prev + 1) % CODE_TEXT_FRAMES.length)
  // }, 400)

  // onCleanup(() => clearInterval(intervalId))

  // Get current CODE_TEXT based on animation frame
  const CODE_TEXT = () => CODE_TEXT_FRAMES[currentFrame()]

  // Check if width is narrow
  const isNarrow = () => dimensions().width < 100
  // Check if height is short
  const isShort = () => dimensions().height < 22
  // If height is tall (>30 lines), show stacked. Otherwise, side-by-side
  const hasTallHeight = () => dimensions().height > 30

  return (
    <box flexDirection="column" gap={0}>
      <Show when={dimensions().height >= 13}>
        <Show
          when={!isNarrow() && !isShort()}
          fallback={
            // Narrow or short terminal: show tiny font (SIMPLE_TEXT)
            <box flexDirection="column" gap={0} alignItems="center">
              <For each={SIMPLE_TEXT}>
                {(line) => (
                  <text fg={themeCtx.theme.primary}>{line}</text>
                )}
              </For>
            </box>
          }
        >
        <Show
          when={hasTallHeight()}
          fallback={
            // Short terminal: side-by-side to save vertical space
            <>
              <For each={CODE_TEXT()}>
                {(codeLine, index) => (
                  <box flexDirection="row" gap={2}>
                    <ColoredLine line={codeLine} blockColor={() => themeCtx.theme.primary} borderColor={() => themeCtx.theme.purple} />
                    {MACHINE_TEXT[index()] && (
                      <ColoredLine line={MACHINE_TEXT[index()]} blockColor={() => themeCtx.theme.primary} borderColor={() => themeCtx.theme.purple} bold />
                    )}
                  </box>
                )}
              </For>
              {/* Render the arrow line (7th line of MACHINE_TEXT) */}
              <box flexDirection="row" gap={2}>
                <box width={CODE_TEXT()[0].length} />
                <ColoredLine line={MACHINE_TEXT[6]} blockColor={() => themeCtx.theme.primary} borderColor={() => themeCtx.theme.purple} bold />
              </box>
            </>
          }
        >
          {/* Tall terminal: stacked vertically (normal) */}
          <For each={CODE_TEXT()}>
            {(line) => <ColoredLine line={line} blockColor={() => themeCtx.theme.primary} borderColor={() => themeCtx.theme.purple} />}
          </For>
          <box height={1} />
          <For each={MACHINE_TEXT}>
            {(line) => <ColoredLine line={line} blockColor={() => themeCtx.theme.primary} borderColor={() => themeCtx.theme.purple} bold />}
          </For>
        </Show>
        </Show>
      </Show>
    </box>
  )
}
