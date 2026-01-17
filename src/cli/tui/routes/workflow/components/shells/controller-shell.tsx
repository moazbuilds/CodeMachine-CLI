/** @jsxImportSource @opentui/solid */
/**
 * Controller Shell Component
 *
 * Renders the controller view layout - full-width output window
 * for controller conversation (no timeline).
 */

import { OutputWindow } from "../output"
import type { useWorkflowShell } from "../../hooks/use-workflow-shell"

export interface ControllerShellProps {
  shell: ReturnType<typeof useWorkflowShell>
}

export function ControllerShell(props: ControllerShellProps) {
  const { shell } = props
  const availableWidth = () => Math.floor((shell.dimensions()?.width ?? 80) * 1)

  return (
    <box flexDirection="column" width="100%">
      <OutputWindow
        currentAgent={null}
        controllerState={shell.state().controllerState}
        availableWidth={availableWidth()}
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
        inputState={shell.state().inputState}
        workflowStatus={shell.state().workflowStatus}
        isPromptBoxFocused={shell.isPromptBoxFocused()}
        onPromptSubmit={shell.handlePromptSubmit}
        onSkip={shell.handleSkip}
        onPromptBoxFocusExit={() => shell.setIsPromptBoxFocused(false)}
      />
    </box>
  )
}
