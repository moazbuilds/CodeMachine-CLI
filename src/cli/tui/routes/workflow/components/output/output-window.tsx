/** @jsxImportSource @opentui/solid */
/**
 * Output Window Component
 * Ported from: src/ui/components/OutputWindow.tsx
 *
 * Display current agent's output with syntax highlighting
 * Shows last N lines with auto-scroll for running agents
 */

import { Show, For, createMemo } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { ShimmerText } from "./shimmer-text"
import type { AgentState, SubAgentState } from "../../state/types"

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
 * Displays last N lines with syntax highlighting
 */
export function OutputWindow(props: OutputWindowProps) {
  const themeCtx = useTheme()

  const effectiveMaxLines = () => props.maxLines ?? 20

  // Determine agent type
  const agentType = () => {
    if (!props.currentAgent) return ""
    return "parentId" in props.currentAgent ? "sub-agent" : "main"
  }

  // Get display lines (last N lines)
  const displayLines = createMemo(() => {
    const lines = props.lines
    const max = effectiveMaxLines()
    if (lines.length > max) {
      return lines.slice(lines.length - max)
    }
    return lines
  })

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
            height={effectiveMaxLines()}
            justifyContent="center"
            alignItems="center"
          >
            <text fg={themeCtx.theme.textMuted}>No agent selected</text>
          </box>
        }
      >
        <box paddingLeft={1} paddingRight={1} paddingBottom={1} justifyContent="space-between">
          <text fg={themeCtx.theme.text} attributes={1 | 4}>
            Output: {props.currentAgent!.name}
          </text>
          <text fg={themeCtx.theme.textMuted}>
            [{agentType()}] [{props.currentAgent!.engine}] [{props.currentAgent!.status}]
          </text>
        </box>

        {/* Output area */}
        <box paddingLeft={1} paddingRight={1} flexDirection="column" flexGrow={1}>
          <Show when={props.isLoading}>
            <text fg={themeCtx.theme.textMuted}>Waiting for agent output...</text>
          </Show>

          <Show when={props.isConnecting && !props.isLoading}>
            <box flexDirection="row">
              <text fg={themeCtx.theme.text}>⠋ </text>
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
            <box flexDirection="column">
              <For each={displayLines()}>{(line) => <OutputLine line={line} />}</For>
            </box>
          </Show>
        </box>
      </Show>
    </box>
  )
}

/**
 * Single output line with basic syntax highlighting
 */
function OutputLine(props: { line: string }) {
  const themeCtx = useTheme()

  // Basic color detection from markers
  const lineColor = createMemo(() => {
    const line = props.line
    if (line.startsWith("\x1b[32m") || line.includes("✓") || line.includes("success")) {
      return themeCtx.theme.success
    }
    if (line.startsWith("\x1b[31m") || line.includes("✗") || line.includes("error") || line.includes("Error")) {
      return themeCtx.theme.error
    }
    if (line.startsWith("\x1b[33m") || line.includes("warning") || line.includes("Warning")) {
      return themeCtx.theme.warning
    }
    if (line.startsWith("\x1b[90m") || line.startsWith("●")) {
      return themeCtx.theme.textMuted
    }
    return themeCtx.theme.text
  })

  // Strip ANSI codes for display
  const cleanLine = createMemo(() => {
    // eslint-disable-next-line no-control-regex
    return props.line.replace(/\x1b\[[0-9;]*m/g, "")
  })

  return <text fg={lineColor()}>{cleanLine()}</text>
}
