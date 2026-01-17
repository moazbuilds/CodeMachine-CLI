/** @jsxImportSource @opentui/solid */
/**
 * Executing Shell Component
 *
 * Renders the executing view layout - timeline + output window split view.
 */

import { Show } from "solid-js"
import { AgentTimeline } from "../timeline"
import { OutputWindow } from "../output"
import type { useWorkflowShell } from "../../hooks/use-workflow-shell"

export interface ExecutingShellProps {
  shell: ReturnType<typeof useWorkflowShell>
}

export function ExecutingShell(props: ExecutingShellProps) {
  const { shell } = props

  // Layout calculations
  const MIN_WIDTH_FOR_SPLIT_VIEW = 100
  const showOutputPanel = () => (shell.dimensions()?.width ?? 80) >= MIN_WIDTH_FOR_SPLIT_VIEW

  const timelineWidth = () => showOutputPanel() ? "35%" : "100%"
  const outputWidth = () => shell.isTimelineCollapsed() ? "100%" : "65%"

  const timelineAvailableWidth = () =>
    Math.floor((shell.dimensions()?.width ?? 80) * (showOutputPanel() ? 0.35 : 1))

  const outputAvailableWidth = () =>
    Math.floor((shell.dimensions()?.width ?? 80) * (shell.isTimelineCollapsed() ? 1 : 0.65))

  // Input state - only show when viewing the active agent
  const inputStateForOutput = () =>
    shell.isShowingRunningAgent() ? shell.state().inputState : null

  return (
    <>
      {/* Timeline - hidden when collapsed */}
      <Show when={!shell.isTimelineCollapsed()}>
        <box flexDirection="column" width={timelineWidth()}>
          <AgentTimeline
            state={shell.state()}
            onToggleExpand={(id) => shell.ui.actions.toggleExpand(id)}
            availableHeight={shell.state().visibleItemCount}
            availableWidth={timelineAvailableWidth()}
            isPromptBoxFocused={shell.isPromptBoxFocused()}
          />
        </box>
      </Show>

      {/* Output Window */}
      <Show when={showOutputPanel() || shell.isTimelineCollapsed()}>
        <box flexDirection="column" width={outputWidth()}>
          <OutputWindow
            currentAgent={shell.currentAgent()}
            controllerState={shell.state().controllerState}
            availableWidth={outputAvailableWidth()}
            lines={shell.logStream.lines}
            isLoading={shell.logStream.isLoading}
            isConnecting={shell.logStream.isConnecting}
            error={shell.logStream.error}
            latestThinking={shell.logStream.latestThinking}
            hasMoreAbove={shell.logStream.hasMoreAbove}
            isLoadingEarlier={shell.logStream.isLoadingEarlier}
            loadEarlierError={shell.logStream.loadEarlierError}
            onLoadMore={() => shell.logStream.loadEarlierLines()}
            onPauseTrimmingChange={(paused) => shell.logStream.setPauseTrimming(paused)}
            inputState={inputStateForOutput()}
            workflowStatus={shell.state().workflowStatus}
            isPromptBoxFocused={shell.isPromptBoxFocused()}
            onPromptSubmit={shell.handlePromptSubmit}
            onSkip={shell.handleSkip}
            onPromptBoxFocusExit={() => shell.setIsPromptBoxFocused(false)}
          />
        </box>
      </Show>
    </>
  )
}
