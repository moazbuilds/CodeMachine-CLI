/** @jsxImportSource @opentui/solid */
/**
 * Shared Layout Component
 *
 * Provides the common layout structure (header, footer, modals) for both
 * onboarding and executing phases.
 */

import { Show, type JSX } from "solid-js"
import { BrandingHeader } from "@tui/shared/components/layout/branding-header"
import { TelemetryBar, StatusFooter } from "../output"
import {
  CheckpointModal,
  LogViewer,
  HistoryView,
  StopModal,
  ErrorModal,
  ControllerContinueModal
} from "../modals"
import type { useWorkflowShell } from "../../hooks/use-workflow-shell"

export interface SharedLayoutProps {
  version: string
  currentDir: string
  shell: ReturnType<typeof useWorkflowShell>
  children: JSX.Element
}

export function SharedLayout(props: SharedLayoutProps) {
  const { shell } = props

  return (
    <box flexDirection="column" height="100%">
      {/* Header */}
      <box flexShrink={0}>
        <BrandingHeader version={props.version} currentDir={props.currentDir} />
      </box>

      {/* Main content area - injected by phase-specific shells */}
      <box flexDirection="row" flexGrow={1} gap={1}>
        {props.children}
      </box>

      {/* Footer */}
      <box flexShrink={0} flexDirection="column">
        <TelemetryBar
          workflowName={shell.state().workflowName}
          runtime={shell.timer.workflowRuntime()}
          status={shell.state().workflowStatus}
          total={shell.totalTelemetry()}
          autonomousMode={shell.state().autonomousMode}
        />
        <StatusFooter
          autonomousMode={shell.state().autonomousMode}
          phase={shell.state().phase}
          hasController={!!shell.state().controllerState}
        />
      </box>

      {/* Modals */}
      <Show when={shell.isCheckpointActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <CheckpointModal
            reason={shell.state().checkpointState?.reason}
            onContinue={shell.handleCheckpointContinue}
            onQuit={shell.handleCheckpointQuit}
          />
        </box>
      </Show>

      <Show when={shell.modals.isLogViewerActive()}>
        <box
          position="absolute"
          left={0}
          top={0}
          width="100%"
          height="100%"
          zIndex={1000}
          backgroundColor={shell.themeCtx.theme.background}
        >
          <LogViewer
            agentId={shell.modals.logViewerAgentId()!}
            getMonitoringId={shell.getMonitoringId}
            onClose={() => shell.modals.setLogViewerAgentId(null)}
          />
        </box>
      </Show>

      <Show when={shell.modals.isHistoryActive()}>
        <box
          position="absolute"
          left={0}
          top={0}
          width="100%"
          height="100%"
          zIndex={1000}
          backgroundColor={shell.themeCtx.theme.background}
        >
          <HistoryView
            onClose={() => shell.modals.setShowHistory(false)}
            onOpenLogViewer={(id) => {
              shell.modals.setHistoryLogViewerMonitoringId(id)
              shell.modals.setShowHistory(false)
            }}
            initialSelectedIndex={shell.modals.historySelectedIndex()}
            onSelectedIndexChange={shell.modals.setHistorySelectedIndex}
          />
        </box>
      </Show>

      <Show when={shell.modals.isHistoryLogViewerActive()}>
        <box
          position="absolute"
          left={0}
          top={0}
          width="100%"
          height="100%"
          zIndex={1000}
          backgroundColor={shell.themeCtx.theme.background}
        >
          <LogViewer
            agentId={String(shell.modals.historyLogViewerMonitoringId())}
            getMonitoringId={() => shell.modals.historyLogViewerMonitoringId() ?? undefined}
            onClose={() => {
              shell.modals.setHistoryLogViewerMonitoringId(null)
              shell.modals.setShowHistory(true)
            }}
          />
        </box>
      </Show>

      <Show when={shell.showStopModal()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <StopModal
            onConfirm={shell.handleStopConfirm}
            onCancel={shell.handleStopCancel}
          />
        </box>
      </Show>

      <Show when={shell.isErrorModalActive()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <ErrorModal
            message={shell.errorMessage()!}
            onClose={shell.handleErrorModalClose}
          />
        </box>
      </Show>

      <Show when={shell.showControllerContinueModal()}>
        <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={2000}>
          <ControllerContinueModal
            onConfirm={shell.handleControllerContinueConfirm}
            onCancel={shell.handleControllerContinueCancel}
          />
        </box>
      </Show>
    </box>
  )
}
