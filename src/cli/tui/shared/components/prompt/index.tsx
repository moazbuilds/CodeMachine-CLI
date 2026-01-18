/** @jsxImportSource @opentui/solid */
import { createSignal, Show, For } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { useTerminalDimensions } from "@opentui/solid"
import type { PromptProps, SlashCommand } from "./types"
import type { BoxRenderable } from "@opentui/core"

const SLASH_COMMANDS: SlashCommand[] = [
  { command: "start", description: "Start workflow with current template" },
  { command: "templates", description: "Select and configure workflow templates" },
  { command: "login", description: "Authenticate with AI providers" },
  { command: "logout", description: "Sign out of AI providers" },
  { command: "import", description: "Import external workflow packages" },
  { command: "export", description: "Open imports folder in file explorer" },
  { command: "exit", description: "Exit the session" },
]

export function Prompt(props: PromptProps) {
  let anchor: BoxRenderable | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inputRef: any

  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [input, setInput] = createSignal("")
  const [showAutocomplete, setShowAutocomplete] = createSignal(false)
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  // Calculate responsive width (80% of terminal width, max 100, min 50)
  const promptWidth = () => Math.min(100, Math.max(50, Math.floor(dimensions().width * 0.8)))

  const filteredCommands = () => {
    const value = input()
    if (!value.startsWith("/")) return []
    const query = value.slice(1).toLowerCase()
    return SLASH_COMMANDS.filter((cmd) =>
      cmd.command.toLowerCase().startsWith(query)
    )
  }

  const handleInput = (value: string) => {
    if (props.disabled) return
    setInput(value)
    const shouldShow = value.startsWith("/") && filteredCommands().length > 0
    setShowAutocomplete(shouldShow)
    setSelectedIndex(0)
  }

  const handleSubmit = () => {
    if (props.disabled) return
    const value = input()
    if (!value.trim()) return

    setInput("")
    setShowAutocomplete(false)
    props.onSubmit(value.trim())
  }

  const handleKeyDown = (evt: { name?: string }) => {
    if (props.disabled) return
    if (showAutocomplete() && filteredCommands().length > 0) {
      if (evt.name === "up") {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
        return
      } else if (evt.name === "down") {
        setSelectedIndex((prev) =>
          Math.min(filteredCommands().length - 1, prev + 1)
        )
        return
      } else if (evt.name === "tab") {
        const selected = filteredCommands()[selectedIndex()]
        if (selected) {
          const newValue = `/${selected.command}`
          setInput(newValue)
          setShowAutocomplete(false)
          // Move cursor to end of completed text
          inputRef?.setCursorByOffset?.(newValue.length)
          return
        }
      } else if (evt.name === "return") {
        // Auto-complete and execute the selected command
        const selected = filteredCommands()[selectedIndex()]
        if (selected) {
          const fullCommand = `/${selected.command}`
          setInput("")
          setShowAutocomplete(false)
          props.onSubmit(fullCommand)
          return
        }
      } else if (evt.name === "escape") {
        setShowAutocomplete(false)
        return
      }
    }

    if (evt.name === "return") {
      handleSubmit()
    }
  }

  // Calculate autocomplete dropdown height
  const autocompleteHeight = () => Math.min(10, filteredCommands().length)

  // Get anchor position reactively - this will update when layout changes
  const anchorPosition = () => {
    if (!anchor) return { x: 0, y: 0, width: promptWidth() }
    // Accessing these properties directly makes them reactive to layout changes
    return {
      x: anchor.x,
      y: anchor.y,
      width: anchor.width,
    }
  }

  return (
    <>
      {/* Autocomplete dropdown - absolutely positioned, rendered as sibling */}
      <Show when={showAutocomplete() && filteredCommands().length > 0}>
        <box
          position="absolute"
          top={anchorPosition().y - autocompleteHeight() - 4}
          left={anchorPosition().x}
          width={anchorPosition().width}
          zIndex={100}
          borderColor={themeCtx.theme.border}
          border={["top", "bottom", "left", "right"]}
          borderStyle="rounded"
          backgroundColor={themeCtx.theme.background}
        >
          <box flexDirection="column" gap={0} paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
            <For each={filteredCommands()}>
              {(cmd, index) => {
                const isSelected = () => index() === selectedIndex()
                return (
                  <box flexDirection="row" gap={1}>
                    <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                      {isSelected() ? "●" : "○"}
                    </text>
                    <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.text}>
                      /{cmd.command}
                    </text>
                    <text fg={themeCtx.theme.textMuted}>- {cmd.description}</text>
                  </box>
                )
              }}
            </For>
          </box>
        </box>
      </Show>

      {/* Input box - the anchor */}
      <box ref={(r) => (anchor = r)} flexDirection="column" gap={0} width={promptWidth()}>
        <box
          borderColor={themeCtx.theme.border}
          border={["top", "bottom", "left", "right"]}
          borderStyle="rounded"
          paddingLeft={1}
          paddingRight={1}
          paddingBottom={1}
        >
          <input
            ref={(r) => (inputRef = r)}
            value={input()}
            placeholder={props.disabled ? "Dialog open..." : (props.placeholder || "Type /start to see the magic")}
            placeholderColor={themeCtx.theme.textMuted}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            focused={!props.disabled}
            textColor={themeCtx.theme.text}
            focusedTextColor={themeCtx.theme.text}
            cursorColor={themeCtx.theme.primary}
            backgroundColor="transparent"
            focusedBackgroundColor="transparent"
          />
        </box>

        <Show when={props.hint}>
          <box marginTop={1}>
            <text fg={themeCtx.theme.textMuted}>{props.hint}</text>
          </box>
        </Show>
      </box>
    </>
  )
}
