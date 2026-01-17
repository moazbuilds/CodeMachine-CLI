/** @jsxImportSource @opentui/solid */
/**
 * Output Window Component
 * Ported from: src/ui/components/OutputWindow.tsx
 *
 * Display current agent's output with syntax highlighting
 * Shows last N lines with auto-scroll for running agents using OpenTUI scrollbox
 */

import type { ScrollBoxRenderable } from "@opentui/core"
import { Show, For, createMemo, createSignal, createEffect, onCleanup, on } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { debug } from "../../../../../../shared/logging/logger.js"
import { ShimmerText } from "./shimmer-text"
import { TypingText } from "./typing-text"
import { LogLine } from "../shared/log-line"
import { LogTable } from "../shared/log-table"
import { groupLinesWithTables } from "../shared/markdown-table"
import { PromptLine, type PromptLineState } from "./prompt-line"
import type { AgentState, SubAgentState, InputState, ControllerState } from "../../state/types"

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
  controllerState?: ControllerState | null
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
  // Backward pagination
  hasMoreAbove?: boolean
  isLoadingEarlier?: boolean
  loadEarlierError?: string | null
  onLoadMore?: () => number
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
  const [scrollRef, setScrollRef] = createSignal<ScrollBoxRenderable | undefined>()
  const [userScrolledAway, setUserScrolledAway] = createSignal(false)

  // Reset userScrolledAway when agent changes
  // Use on() to explicitly track only the agent name, not other props
  createEffect(
    on(
      () => props.currentAgent?.name,
      (agentName) => {
        debug('[OutputWindow] Agent changed to: %s, resetting scroll state', agentName)
        setUserScrolledAway(false)
      }
    )
  )

  // Handle scroll events: load earlier lines + track if user scrolled away from bottom
  // Use on() to only track scrollRef changes, not other props
  createEffect(
    on(scrollRef, (ref) => {
      debug('[OutputWindow] Scroll effect running, ref exists: %s', !!ref)
      if (!ref) return

      const handleScrollChange = () => {
        const scrollTop = ref.scrollTop
        const scrollHeight = ref.scrollHeight
        const viewportHeight = ref.height
        const maxScroll = Math.max(0, scrollHeight - viewportHeight)
        const isAtBottom = scrollTop >= maxScroll - 3

        debug('[OutputWindow] scroll: top=%d, max=%d, atBottom=%s, hasMore=%s', scrollTop, maxScroll, isAtBottom, props.hasMoreAbove)

        // Track if user scrolled away from bottom (to disable stickyScroll)
        if (!isAtBottom && !userScrolledAway()) {
          debug('[OutputWindow] User scrolled away from bottom')
          setUserScrolledAway(true)
        } else if (isAtBottom && userScrolledAway()) {
          debug('[OutputWindow] User returned to bottom')
          setUserScrolledAway(false)
        }

        // Trigger load when near the top (within 3 lines) - skip if already loading
        if (scrollTop <= 3 && props.hasMoreAbove && props.onLoadMore && !props.isLoadingEarlier) {
          debug('[OutputWindow] Loading earlier lines...')
          const linesLoaded = props.onLoadMore()
          debug('[OutputWindow] Lines loaded: %d', linesLoaded)
          if (linesLoaded > 0) {
            ref.scrollTop = linesLoaded  // Maintain view position
          }
        }
      }

      debug('[OutputWindow] Setting up scroll listener, verticalScrollBar exists: %s', !!ref.verticalScrollBar)
      ref.verticalScrollBar?.on("change", handleScrollChange)
      onCleanup(() => ref.verticalScrollBar?.off("change", handleScrollChange))
    })
  )

  // Compute whether stickyScroll should be active
  const shouldStickyScroll = () => !userScrolledAway()

  // Check if we have enough width to show status inline (based on output section width)
  const isWideLayout = createMemo(() => (props.availableWidth ?? 80) >= MIN_WIDTH_FOR_INLINE_STATUS)

  const effectiveMaxLines = () => props.maxLines ?? 20

  // Scrollbox height accounts for the output header + prompt line (3 lines)
  const PROMPT_LINE_HEIGHT = 3
  const outputHeaderHeight = () => isWideLayout() ? OUTPUT_HEADER_HEIGHT_WIDE : OUTPUT_HEADER_HEIGHT_NARROW
  const scrollboxHeight = () => Math.max(3, effectiveMaxLines() - outputHeaderHeight() - PROMPT_LINE_HEIGHT)

  // Check if we're in controller view mode (no step agent, but controller has status)
  const isControllerViewMode = () => !props.currentAgent && props.controllerState?.status != null

  // Check if controller is active (delegated state or controller view mode)
  const isControllerActive = () =>
    (props.currentAgent?.status === "delegated" && props.controllerState != null) || isControllerViewMode()

  // Get the effective status (controller in controller view, step agent otherwise)
  const effectiveStatus = () => isControllerViewMode() ? props.controllerState?.status : props.currentAgent?.status

  // Check if agent is running
  const isRunning = () => effectiveStatus() === "running"

  // Get status color
  const statusColor = () => {
    const status = effectiveStatus()
    if (status === "completed") return themeCtx.theme.success
    if (status === "failed") return themeCtx.theme.error
    return themeCtx.theme.warning
  }

  // Get display name/engine/model (controller when delegated or controller view, step agent otherwise)
  const displayName = () => isControllerActive() ? props.controllerState!.name : props.currentAgent?.name
  const displayEngine = () => isControllerActive() ? props.controllerState!.engine : props.currentAgent?.engine
  const displayModel = () => isControllerActive() ? props.controllerState!.model : props.currentAgent?.model

  // Check if we have something to display (agent or controller in controller view)
  const hasDisplayContent = () => props.currentAgent != null || isControllerViewMode()

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

    // Controller view mode: ignore queue, show simple active/passive state
    if (isControllerViewMode()) {
      if (inputState?.active) {
        return { mode: "active", reason: "paused" }
      }
      return { mode: "passive" }
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
        when={hasDisplayContent()}
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
                <text fg={themeCtx.theme.text} attributes={1}>{displayName()}</text>
              </box>
              <box flexDirection="row" gap={1}>
                <text fg={themeCtx.theme.info}>{displayEngine()}</text>
                <Show when={displayModel()}>
                  <text fg={themeCtx.theme.textMuted}>{displayModel()}</text>
                </Show>
                <text fg={statusColor()}>● {effectiveStatus()}</text>
              </box>
            </box>
          </Show>

          {/* Narrow layout: name on one line, status on next line */}
          <Show when={!isWideLayout()}>
            <box flexDirection="row">
              <text fg={themeCtx.theme.border}>│  </text>
              <text fg={themeCtx.theme.text}>{isRunning() && props.latestThinking ? "(╭ರ_•́)" : "(˶ᵔ ᵕ ᵔ˶)"}</text>
              <text>  </text>
              <text fg={themeCtx.theme.text} attributes={1}>{displayName()}</text>
            </box>
            <box flexDirection="row">
              <text fg={themeCtx.theme.border}>│  </text>
              <text fg={themeCtx.theme.info}>{displayEngine()}</text>
              <Show when={displayModel()}>
                <text fg={themeCtx.theme.textMuted}> {displayModel()}</text>
              </Show>
              <text fg={statusColor()}> ● {effectiveStatus()}</text>
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
            {/* Loading earlier lines indicator */}
            <Show when={props.isLoadingEarlier}>
              <text fg={themeCtx.theme.info}>↑ Loading earlier lines...</text>
            </Show>
            {/* Error loading earlier lines */}
            <Show when={props.loadEarlierError}>
              <text fg={themeCtx.theme.error}>↑ Error: {props.loadEarlierError}</text>
            </Show>
            {/* More above indicator (when not loading) */}
            <Show when={props.hasMoreAbove && !props.isLoadingEarlier && !props.loadEarlierError}>
              <text fg={themeCtx.theme.textMuted}>↑ Scroll up for earlier logs</text>
            </Show>
            <scrollbox
              ref={(r: ScrollBoxRenderable) => setScrollRef(r)}
              flexGrow={1}
              width="100%"
              stickyScroll={shouldStickyScroll()}
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
              <For each={groupLinesWithTables(props.lines)}>
                {(group) => (
                  <Show
                    when={group.type === 'table'}
                    fallback={<LogLine line={group.lines[0]} />}
                  >
                    <LogTable lines={group.lines} />
                  </Show>
                )}
              </For>
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
