/** @jsxImportSource @opentui/solid */
/**
 * Output Window Component
 * Ported from: src/ui/components/OutputWindow.tsx
 *
 * Display current agent's output with syntax highlighting
 * Shows last N lines with auto-scroll for running agents using OpenTUI scrollbox
 */

import { Show, For } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { ShimmerText } from "./shimmer-text"
import { TypingText } from "./typing-text"
import { LogLine } from "../shared/log-line"
import { ChainedPromptBox } from "./chained-box"
import type { AgentState, SubAgentState, ChainedState } from "../../state/types"

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
  // Chained prompt box props
  chainedState?: ChainedState | null
  isPromptBoxFocused?: boolean
  onChainedCustom?: (prompt: string) => void
  onChainedNext?: () => void
  onChainedSkip?: () => void
  onPromptBoxFocusExit?: () => void
}

/**
 * Output window showing current agent's output
 * Displays last N lines with syntax highlighting using scrollbox
 */
const OUTPUT_HEADER_HEIGHT = 5  // Side curve header (5 lines: padding + ╭─ + info + thinking + ╰─)

export function OutputWindow(props: OutputWindowProps) {
  const themeCtx = useTheme()

  const effectiveMaxLines = () => props.maxLines ?? 20

  // Scrollbox height accounts for the output header
  const scrollboxHeight = () => Math.max(3, effectiveMaxLines() - OUTPUT_HEADER_HEIGHT)

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
        {/* Side Curve Header */}
        <box flexDirection="column" paddingLeft={1} paddingTop={1} height={5} flexShrink={0}>
          <text fg={themeCtx.theme.border}>╭─</text>
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
              <text fg={themeCtx.theme.text}>* </text>
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

          {/* Chained prompt box - shown when chaining is active */}
          <ChainedPromptBox
            isVisible={props.chainedState?.active ?? false}
            isFocused={props.isPromptBoxFocused ?? false}
            currentIndex={props.chainedState?.currentIndex ?? 0}
            totalPrompts={props.chainedState?.totalPrompts ?? 0}
            nextPromptLabel={props.chainedState?.nextPromptLabel ?? null}
            onCustomPrompt={props.onChainedCustom ?? (() => {})}
            onNextStep={props.onChainedNext ?? (() => {})}
            onSkipAll={props.onChainedSkip ?? (() => {})}
            onFocusExit={props.onPromptBoxFocusExit ?? (() => {})}
          />
        </box>
      </Show>
    </box>
  )
}
