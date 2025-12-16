/** @jsxImportSource @opentui/solid */
/**
 * Output Window Component
 * Ported from: src/ui/components/OutputWindow.tsx
 *
 * Display current agent's output with syntax highlighting
 * Shows last N lines with auto-scroll for running agents using OpenTUI scrollbox
 */

import { Show, For, createMemo } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { ShimmerText } from "./shimmer-text"
import { TypingText } from "./typing-text"
import { LogLine } from "../shared/log-line"
import { PromptLine, type PromptLineState } from "./prompt-line"
import type { AgentState, SubAgentState, InputState } from "../../state/types"

// Rotating messages shown while connecting to agent
const CONNECTING_MESSAGES = [
  "Initializing agent environment",
  "Loading agent configuration",
  "Starting execution engine",
  "Establishing log stream",
  "Agent starting up",
]

export interface OutputWindowProps {
  currentAgent: AgentState | SubAgentState | null
  lines: string[]
  isLoading: boolean
  isConnecting: boolean
  error: string | null
  maxLines?: number
  connectingMessageIndex?: number
  latestThinking?: string | null
  // Prompt line props
  inputState?: InputState | null
  workflowStatus?: string
  isPromptBoxFocused?: boolean
  onPromptSubmit?: (prompt: string) => void
  onSkip?: () => void
  onPromptBoxFocusExit?: () => void
  // Responsive layout
  availableWidth?: number
}

/**
 * Output window showing current agent's output
 * Displays last N lines with syntax highlighting using scrollbox
 */
const OUTPUT_HEADER_HEIGHT_WIDE = 4  // Side curve header when wide (╭─ + info + thinking + ╰─)
const OUTPUT_HEADER_HEIGHT_NARROW = 5  // Side curve header when narrow (extra line for status)
const MIN_WIDTH_FOR_INLINE_STATUS = 75  // Minimum width to show status inline with name

export function OutputWindow(props: OutputWindowProps) {
  const themeCtx = useTheme()

  // Check if we have enough width to show status inline (based on output section width)
  const isWideLayout = createMemo(() => (props.availableWidth ?? 80) >= MIN_WIDTH_FOR_INLINE_STATUS)

  const effectiveMaxLines = () => props.maxLines ?? 20

  // Scrollbox height accounts for the output header + prompt line (3 lines)
  const PROMPT_LINE_HEIGHT = 3
  const outputHeaderHeight = () => isWideLayout() ? OUTPUT_HEADER_HEIGHT_WIDE : OUTPUT_HEADER_HEIGHT_NARROW
  const scrollboxHeight = () => Math.max(3, effectiveMaxLines() - outputHeaderHeight() - PROMPT_LINE_HEIGHT)

  // Check if agent is running
  const isRunning = () => props.currentAgent?.status === "running"

  // Get status color
  const statusColor = () => {
    const status = props.currentAgent?.status
    if (status === "completed") return themeCtx.theme.success
    if (status === "failed") return themeCtx.theme.error
    return themeCtx.theme.warning
  }

  // Get connecting message
  const connectingMessage = () => {
    const idx = props.connectingMessageIndex ?? 0
    return CONNECTING_MESSAGES[idx % CONNECTING_MESSAGES.length]
  }

  // Compute prompt line state from unified inputState
  const promptLineState = (): PromptLineState => {
    const status = props.workflowStatus
    const inputState = props.inputState

    // Workflow not running or completed
    if (!status || status === "completed" || status === "stopped" || status === "idle") {
      return { mode: "disabled" }
    }

    // Input state active (unified pause/chained)
    if (inputState?.active) {
      // Has queued prompts = show chained UI
      if (inputState.queuedPrompts && inputState.queuedPrompts.length > 0) {
        const idx = inputState.currentIndex ?? 0
        const prompt = inputState.queuedPrompts[idx]
        return {
          mode: "chained",
          name: prompt?.name ?? "next step",
          description: prompt?.label ?? "",
          index: idx + 1,
          total: inputState.queuedPrompts.length,
        }
      }
      // No queue = simple pause/steering
      return { mode: "active", reason: "paused" }
    }

    // Running but not waiting for input
    if (status === "running" || status === "stopping") {
      // Preserve chained step info even when agent is working
      if (inputState?.queuedPrompts && inputState.queuedPrompts.length > 0) {
        const idx = inputState.currentIndex ?? 0
        const prompt = inputState.queuedPrompts[idx]
        return {
          mode: "passive",
          chainedStep: {
            name: prompt?.name ?? "next step",
            index: idx + 1,
            total: inputState.queuedPrompts.length,
          },
        }
      }
      return { mode: "passive" }
    }

    return { mode: "disabled" }
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <Show
        when={props.currentAgent}
        fallback={
          <box
            flexDirection="column"
            flexGrow={1}
            height={scrollboxHeight()}
            justifyContent="center"
            alignItems="center"
          >
            <text fg={themeCtx.theme.textMuted}>No agent selected</text>
          </box>
        }
      >
        {/* Side Curve Header - Responsive layout */}
        <box flexDirection="column" paddingLeft={1} height={outputHeaderHeight()} flexShrink={0}>
          <text fg={themeCtx.theme.border}>╭─</text>

          {/* Wide layout: name and status on same line */}
          <Show when={isWideLayout()}>
            <box flexDirection="row" justifyContent="space-between" paddingRight={2}>
              <box flexDirection="row">
                <text fg={themeCtx.theme.border}>│  </text>
                <text fg={themeCtx.theme.text}>{isRunning() && props.latestThinking ? "(╭ರ_•́)" : "(˶ᵔ ᵕ ᵔ˶)"}</text>
                <text>  </text>
                <text fg={themeCtx.theme.text} attributes={1}>{props.currentAgent!.name}</text>
              </box>
              <box flexDirection="row" gap={1}>
                <text fg={themeCtx.theme.info}>{props.currentAgent!.engine}</text>
                <Show when={props.currentAgent!.model}>
                  <text fg={themeCtx.theme.textMuted}>{props.currentAgent!.model}</text>
                </Show>
                <text fg={statusColor()}>● {props.currentAgent!.status}</text>
              </box>
            </box>
          </Show>

          {/* Narrow layout: name on one line, status on next line */}
          <Show when={!isWideLayout()}>
            <box flexDirection="row">
              <text fg={themeCtx.theme.border}>│  </text>
              <text fg={themeCtx.theme.text}>{isRunning() && props.latestThinking ? "(╭ರ_•́)" : "(˶ᵔ ᵕ ᵔ˶)"}</text>
              <text>  </text>
              <text fg={themeCtx.theme.text} attributes={1}>{props.currentAgent!.name}</text>
            </box>
            <box flexDirection="row">
              <text fg={themeCtx.theme.border}>│  </text>
              <text fg={themeCtx.theme.info}>{props.currentAgent!.engine}</text>
              <Show when={props.currentAgent!.model}>
                <text fg={themeCtx.theme.textMuted}> {props.currentAgent!.model}</text>
              </Show>
              <text fg={statusColor()}> ● {props.currentAgent!.status}</text>
            </box>
          </Show>

          <box flexDirection="row">
            <text fg={themeCtx.theme.border}>│  </text>
            <Show when={isRunning() && props.latestThinking} fallback={<text fg={themeCtx.theme.textMuted}>↳ Waiting...</text>}>
              <TypingText text={`↳ ${props.latestThinking}`} speed={30} />
            </Show>
          </box>
          <text fg={themeCtx.theme.border}>╰─</text>
        </box>
        {/* Output area */}
        <box paddingLeft={1} paddingRight={1} flexDirection="column" flexGrow={1}>
          <Show when={props.isLoading}>
            <text fg={themeCtx.theme.textMuted}>Waiting for agent output...</text>
          </Show>

          <Show when={props.isConnecting && !props.isLoading}>
            <box flexDirection="row">
              <text fg={themeCtx.theme.text}>● </text>
              <ShimmerText text={connectingMessage()} />
            </box>
          </Show>

          <Show when={props.error}>
            <text fg={themeCtx.theme.error}>Error loading logs: {props.error}</text>
          </Show>

          <Show when={!props.isLoading && !props.isConnecting && !props.error && props.lines.length === 0}>
            <text fg={themeCtx.theme.textMuted}>Waiting for output...</text>
          </Show>

          <Show when={!props.isLoading && !props.isConnecting && !props.error && props.lines.length > 0}>
            <scrollbox
              flexGrow={1}
              width="100%"
              stickyScroll={true}
              stickyStart="bottom"
              scrollbarOptions={{
                showArrows: true,
                trackOptions: {
                  foregroundColor: themeCtx.theme.info,
                  backgroundColor: themeCtx.theme.borderSubtle,
                },
              }}
              viewportCulling={true}
              focused={!props.isPromptBoxFocused}
            >
              <For each={props.lines}>{(line) => <LogLine line={line} />}</For>
            </scrollbox>
          </Show>

        </box>

        {/* Always-present prompt line */}
        <PromptLine
          state={promptLineState()}
          isFocused={props.isPromptBoxFocused ?? false}
          onSubmit={props.onPromptSubmit ?? (() => {})}
          onSkip={props.onSkip}
          onFocusExit={props.onPromptBoxFocusExit ?? (() => {})}
        />
      </Show>
    </box>
  )
}
