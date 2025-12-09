/** @jsxImportSource @opentui/solid */
/**
 * Output Window Component
 * Ported from: src/ui/components/OutputWindow.tsx
 *
 * Display current agent's output with syntax highlighting
 * Shows last N lines with auto-scroll for running agents using OpenTUI scrollbox
 */

import { Show, For, createMemo, createSignal } from "solid-js"
import { useInput } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ShimmerText } from "./shimmer-text"
import { LogLine } from "../shared/log-line"
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
}

/**
 * Output window showing current agent's output
 * Displays last N lines with syntax highlighting using scrollbox
 */
const OUTPUT_HEADER_HEIGHT = 2  // Header line + padding

export function OutputWindow(props: OutputWindowProps) {
  const themeCtx = useTheme()

  const effectiveMaxLines = () => props.maxLines ?? 20

  // Scrollbox height accounts for the output header
  const scrollboxHeight = () => Math.max(3, effectiveMaxLines() - OUTPUT_HEADER_HEIGHT)

  // Determine agent type
  const agentType = () => {
    if (!props.currentAgent) return ""
    return "parentId" in props.currentAgent ? "sub-agent" : "main"
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
        <box paddingLeft={1} paddingRight={1} paddingBottom={1} flexDirection="row" justifyContent="space-between">
          <text fg={themeCtx.theme.text} attributes={1 | 4}>
            Output: {props.currentAgent!.name}
          </text>
          <box flexDirection="row" gap={1}>
            <text fg={themeCtx.theme.textMuted}>{agentType()}</text>
            <text fg={themeCtx.theme.info}>{props.currentAgent!.engine}</text>
            <text fg={props.currentAgent!.status === "completed" ? themeCtx.theme.success : props.currentAgent!.status === "failed" ? themeCtx.theme.error : themeCtx.theme.warning}>
              {props.currentAgent!.status}
            </text>
          </box>
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
              height={scrollboxHeight()}
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
              focused={true}
            >
              <For each={props.lines}>{(line) => <LogLine line={line} />}</For>
            </scrollbox>
          </Show>
        </box>
      </Show>
    </box>
  )
}
