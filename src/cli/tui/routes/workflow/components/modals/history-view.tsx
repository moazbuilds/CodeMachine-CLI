/** @jsxImportSource @opentui/solid */
/**
 * History View Component
 * Ported from: src/ui/components/HistoryView.tsx
 *
 * Full-screen history view showing all agent executions from registry
 * Displays nested tree structure with box-drawing characters
 */

import { createSignal, createMemo, createEffect, For, Show, onCleanup } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { useRegistrySync } from "../../hooks/useRegistrySync"
import type { AgentRecord } from "../../../../../../agents/monitoring/types.js"
import type { AgentTreeNode } from "../../../../../../agents/monitoring/index.js"
import { formatTokens } from "../../state/formatters"

export interface HistoryViewProps {
  onClose: () => void
  onOpenLogViewer: (monitoringId: number) => void
}

/**
 * Flattened agent item with nesting metadata
 */
interface FlattenedAgent {
  agent: AgentRecord
  depth: number
  isLast: boolean
  parentIsLast: boolean[]
}

/**
 * Flatten tree structure for rendering and navigation
 */
function flattenTree(tree: AgentTreeNode[]): FlattenedAgent[] {
  const result: FlattenedAgent[] = []

  function traverse(nodes: AgentTreeNode[], depth: number, parentIsLast: boolean[]) {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1

      result.push({
        agent: node.agent,
        depth,
        isLast,
        parentIsLast,
      })

      if (node.children.length > 0) {
        traverse(node.children, depth + 1, [...parentIsLast, isLast])
      }
    })
  }

  traverse(tree, 0, [])
  return result
}

/**
 * Format duration in milliseconds to readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

export function HistoryView(props: HistoryViewProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const { tree: liveTree, isLoading } = useRegistrySync()

  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [scrollOffset, setScrollOffset] = createSignal(0)
  const [pauseUpdates, setPauseUpdates] = createSignal(false)
  const [frozenTree, setFrozenTree] = createSignal<AgentTreeNode[]>([])

  let lastInteractionTime = Date.now()

  // Use frozen tree when paused, live tree when not paused
  const displayTree = () => (pauseUpdates() ? frozenTree() : liveTree)

  // Flatten tree for navigation
  const flattenedAgents = createMemo(() => flattenTree(displayTree()))

  // Calculate visible lines (terminal height - header - footer)
  const visibleLines = createMemo(() => {
    const height = dimensions()?.height ?? 40
    return Math.max(5, height - 8)
  })

  // Update frozen tree when live tree changes and not paused
  createEffect(() => {
    if (!pauseUpdates()) {
      setFrozenTree(liveTree)
    }
  })

  // Clamp selected index to valid range when data changes
  createEffect(() => {
    const agents = flattenedAgents()
    const idx = selectedIndex()
    if (idx >= agents.length && agents.length > 0) {
      setSelectedIndex(agents.length - 1)
    }
  })

  // Auto-scroll to keep selected item visible
  createEffect(() => {
    const idx = selectedIndex()
    const offset = scrollOffset()
    const visible = visibleLines()

    if (idx < offset) {
      setScrollOffset(idx)
    } else if (idx >= offset + visible) {
      setScrollOffset(idx - visible + 1)
    }
  })

  // Auto-resume updates after 2 seconds of no interaction
  createEffect(() => {
    if (pauseUpdates()) {
      const timeout = setTimeout(() => {
        setPauseUpdates(false)
      }, 2000)

      onCleanup(() => clearTimeout(timeout))
    }
  })

  // Get visible agents based on viewport
  const visibleAgents = createMemo(() => {
    const agents = flattenedAgents()
    const offset = scrollOffset()
    const visible = visibleLines()
    return agents.slice(offset, offset + visible)
  })

  // Handle interaction (freeze tree)
  const handleInteraction = () => {
    lastInteractionTime = Date.now()
    if (!pauseUpdates()) {
      setFrozenTree(liveTree)
      setPauseUpdates(true)
    }
  }

  // Keyboard handling
  useKeyboard((evt) => {
    // H or Escape to close
    if (evt.name === "h" || evt.name === "escape") {
      evt.preventDefault()
      props.onClose()
      return
    }

    // Arrow up
    if (evt.name === "up") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex((prev) => Math.max(0, prev - 1))
      return
    }

    // Arrow down
    if (evt.name === "down") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex((prev) => Math.min(flattenedAgents().length - 1, prev + 1))
      return
    }

    // Page up
    if (evt.name === "pageup") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex((prev) => Math.max(0, prev - visibleLines()))
      return
    }

    // Page down
    if (evt.name === "pagedown") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex((prev) => Math.min(flattenedAgents().length - 1, prev + visibleLines()))
      return
    }

    // g - go to top (vim-style)
    if (evt.name === "g" && !evt.shift) {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex(0)
      return
    }

    // G - go to bottom (vim-style)
    if (evt.shift && evt.name === "g") {
      evt.preventDefault()
      handleInteraction()
      setSelectedIndex(flattenedAgents().length - 1)
      return
    }

    // Enter - open log viewer
    if (evt.name === "return") {
      evt.preventDefault()
      const agents = flattenedAgents()
      const selected = agents[selectedIndex()]
      if (selected) {
        props.onOpenLogViewer(selected.agent.id)
      }
      return
    }
  })

  // Use Show for reactive conditional rendering
  return (
    <Show
      when={!isLoading}
      fallback={
        <box flexDirection="column" paddingLeft={1} paddingRight={1}>
          <box justifyContent="center" alignItems="center" paddingTop={2} paddingBottom={2}>
            <text fg={themeCtx.theme.text}>Loading history...</text>
          </box>
        </box>
      }
    >
      <Show
        when={flattenedAgents().length > 0}
        fallback={
          <box flexDirection="column" paddingLeft={1} paddingRight={1}>
            <box justifyContent="center" alignItems="center" paddingTop={2} paddingBottom={2}>
              <text fg={themeCtx.theme.textMuted}>No execution history found</text>
            </box>
            <box paddingTop={1}>
              <text fg={themeCtx.theme.textMuted}>[H/Esc] Close</text>
            </box>
          </box>
        }
      >
        <box flexDirection="column" paddingLeft={1} paddingRight={1}>
          {/* Column Headers */}
          <box paddingTop={1}>
            <box width={6}>
              <text fg={themeCtx.theme.text} attributes={1}>ID</text>
            </box>
            <box width={30}>
              <text fg={themeCtx.theme.text} attributes={1}>Agent</text>
            </box>
            <box width={28}>
              <text fg={themeCtx.theme.text} attributes={1}>Engine/Model</text>
            </box>
            <box width={12}>
              <text fg={themeCtx.theme.text} attributes={1}>Status</text>
            </box>
            <box width={12}>
              <text fg={themeCtx.theme.text} attributes={1}>Duration</text>
            </box>
            <box width={22}>
              <text fg={themeCtx.theme.text} attributes={1}>Tokens</text>
            </box>
          </box>

          {/* Agent Rows */}
          <For each={visibleAgents()}>
            {(item, index) => {
              const absoluteIndex = () => scrollOffset() + index()
              return (
                <AgentRow
                  item={item}
                  isSelected={absoluteIndex() === selectedIndex()}
                />
              )
            }}
          </For>

          {/* Footer */}
          <Show when={flattenedAgents().length > 0}>
            <box paddingTop={1}>
              <text fg={themeCtx.theme.textMuted}>
                Showing {scrollOffset() + 1}-{Math.min(scrollOffset() + visibleLines(), flattenedAgents().length)} of {flattenedAgents().length}
              </text>
              <Show when={!pauseUpdates()}>
                <text fg={themeCtx.theme.success}> {" "} Live</text>
              </Show>
              <Show when={pauseUpdates()}>
                <text fg={themeCtx.theme.warning}> {" "} Paused</text>
              </Show>
            </box>
          </Show>

          <box paddingTop={1}>
            <text fg={themeCtx.theme.textMuted}>
              [H/Esc] Close {" "} [Up/Down] Navigate {" "} [g/G] Top/Bottom {" "} [Enter] Open logs
            </text>
          </box>
        </box>
      </Show>
    </Show>
  )
}

/**
 * Single row in the history tree
 */
function AgentRow(props: { item: FlattenedAgent; isSelected: boolean }) {
  const themeCtx = useTheme()

  const { agent, depth, isLast, parentIsLast } = props.item

  // Build tree prefix with box-drawing characters
  const prefix = () => {
    let result = ""
    for (let i = 0; i < depth; i++) {
      if (i === depth - 1) {
        result += isLast ? "-- " : "+- "
      } else {
        result += parentIsLast[i] ? "   " : "|  "
      }
    }
    return result
  }

  // Status indicator
  const statusChar = () => {
    if (agent.status === "completed") return "*"
    if (agent.status === "failed") return "x"
    return "o"
  }

  const statusColor = () => {
    if (agent.status === "completed") return themeCtx.theme.success
    if (agent.status === "failed") return themeCtx.theme.error
    return themeCtx.theme.warning
  }

  // Calculate duration
  const duration = () => {
    if (agent.duration) {
      return formatDuration(agent.duration)
    }
    if (agent.status === "running") {
      return "Running..."
    }
    return "-"
  }

  // Format engine/model
  const engineModel = () => {
    if (agent.engineProvider && agent.modelName) {
      return `${agent.engineProvider}/${agent.modelName}`
    }
    return agent.engineProvider || "-"
  }

  // Truncate long names
  const displayName = () => prefix() + agent.name
  const truncatedName = () => {
    const name = displayName()
    return name.length > 28 ? name.slice(0, 25) + "..." : name
  }

  // Telemetry
  const tokens = () => {
    if (agent.telemetry) {
      return formatTokens(agent.telemetry.tokensIn, agent.telemetry.tokensOut)
    }
    return "-"
  }

  const bgColor = () => props.isSelected ? themeCtx.theme.primary : undefined

  return (
    <box backgroundColor={bgColor()}>
      <box width={6}>
        <text fg={themeCtx.theme.primary}>{agent.id}</text>
      </box>
      <box width={30}>
        <text fg={themeCtx.theme.text}>{truncatedName()}</text>
      </box>
      <box width={28}>
        <text fg={themeCtx.theme.textMuted}>
          {engineModel().length > 26 ? engineModel().slice(0, 23) + "..." : engineModel()}
        </text>
      </box>
      <box width={12}>
        <text fg={statusColor()}>{statusChar()} {agent.status}</text>
      </box>
      <box width={12}>
        <text fg={themeCtx.theme.text}>{duration()}</text>
      </box>
      <box width={22}>
        <text fg={themeCtx.theme.textMuted}>{tokens()}</text>
      </box>
    </box>
  )
}
