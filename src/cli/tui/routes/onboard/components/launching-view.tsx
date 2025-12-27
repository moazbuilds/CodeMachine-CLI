/** @jsxImportSource @opentui/solid */
/**
 * Launching View Component
 *
 * Shows controller agent initialization progress with spinner and log streaming.
 * Streams logs from the agent's log file using the same mechanism as workflow agents.
 */

import { createSignal, onMount, onCleanup, For, Show } from "solid-js"
import { useTheme } from "@tui/shared/context/theme"
import { Spinner } from "@tui/shared/components/spinner"
import { useLogStream } from "../../workflow/hooks/useLogStream"
import { LogLineInline } from "../../workflow/components/shared/log-line"
import type { WorkflowEventBus } from "../../../../../workflows/events/event-bus"
import type { OnboardingService } from "../../../../../workflows/onboarding/service"

export interface LaunchingViewProps {
  /** Controller agent name being launched */
  controllerName: string
  /** Event bus for receiving log messages */
  eventBus: WorkflowEventBus
  /** Onboarding service to trigger launch */
  service: OnboardingService
  /** Called when launch fails (optional) */
  onError?: (error: string) => void
}

export function LaunchingView(props: LaunchingViewProps) {
  const themeCtx = useTheme()
  const [status, setStatus] = createSignal<'launching' | 'completed' | 'failed'>('launching')
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [monitoringId, setMonitoringId] = createSignal<number | undefined>(undefined)

  // Use the log stream hook to stream logs from the agent's log file
  const logStream = useLogStream(() => monitoringId())

  onMount(() => {
    // Subscribe to monitoring ID event (emitted when agent starts)
    const unsubMonitor = props.eventBus.on('onboard:launching_monitor', (event) => {
      setMonitoringId(event.monitoringId)
    })

    // Subscribe to completion event
    const unsubCompleted = props.eventBus.on('onboard:launching_completed', () => {
      setStatus('completed')
    })

    // Subscribe to failure event
    const unsubFailed = props.eventBus.on('onboard:launching_failed', (event) => {
      setStatus('failed')
      setErrorMessage(event.error)
      props.onError?.(event.error)
    })

    // Trigger the launch
    props.service.launchController()

    onCleanup(() => {
      unsubMonitor()
      unsubCompleted()
      unsubFailed()
    })
  })

  const statusIcon = () => {
    switch (status()) {
      case 'completed':
        return '●'
      case 'failed':
        return '✗'
      default:
        return null
    }
  }

  const statusColor = () => {
    switch (status()) {
      case 'completed':
        return themeCtx.theme.success
      case 'failed':
        return themeCtx.theme.error
      default:
        return themeCtx.theme.primary
    }
  }

  return (
    <box flexDirection="column" gap={1}>
      {/* Header with spinner/status and controller name */}
      <box flexDirection="row" gap={1} alignItems="center">
        {status() === 'launching' ? (
          <Spinner color={themeCtx.theme.primary} />
        ) : (
          <text fg={statusColor()}>{statusIcon()}</text>
        )}
        <text fg={themeCtx.theme.text} attributes={1}>
          {status() === 'launching'
            ? `Initializing ${props.controllerName}...`
            : status() === 'completed'
            ? `${props.controllerName} initialized`
            : `Failed to initialize ${props.controllerName}`}
        </text>
      </box>

      {/* Thinking indicator */}
      <Show when={logStream.latestThinking && status() === 'launching'}>
        <box paddingLeft={2}>
          <text fg={themeCtx.theme.textMuted}>↳ {logStream.latestThinking}</text>
        </box>
      </Show>

      {/* Log streaming area */}
      <Show when={monitoringId() !== undefined}>
        <box flexDirection="column" paddingLeft={2} marginTop={1} height={12}>
          <Show when={logStream.isConnecting}>
            <text fg={themeCtx.theme.textMuted}>Connecting to agent logs...</text>
          </Show>

          <Show when={logStream.error}>
            <text fg={themeCtx.theme.error}>{logStream.error}</text>
          </Show>

          <Show when={!logStream.isConnecting && !logStream.error && logStream.lines.length > 0}>
            <scrollbox
              flexGrow={1}
              width="100%"
              stickyScroll={true}
              stickyStart="bottom"
              scrollbarOptions={{
                showArrows: false,
                trackOptions: {
                  foregroundColor: themeCtx.theme.info,
                  backgroundColor: themeCtx.theme.borderSubtle,
                },
              }}
            >
              <For each={logStream.lines.slice(-15)}>
                {(line) => <LogLineInline line={line} />}
              </For>
            </scrollbox>
          </Show>

          <Show when={!logStream.isConnecting && !logStream.error && logStream.lines.length === 0}>
            <text fg={themeCtx.theme.textMuted}>Waiting for output...</text>
          </Show>
        </box>
      </Show>

      {/* Status messages when no monitoring yet */}
      <Show when={monitoringId() === undefined && status() === 'launching'}>
        <box paddingLeft={2} marginTop={1}>
          <text fg={themeCtx.theme.textMuted}>Starting controller agent...</text>
        </box>
      </Show>

      {/* Error message if failed */}
      <Show when={status() === 'failed' && errorMessage()}>
        <box marginTop={1} paddingLeft={2}>
          <text fg={themeCtx.theme.error}>Error: {errorMessage()}</text>
        </box>
      </Show>

      {/* Footer hint */}
      <box marginTop={2}>
        <text fg={themeCtx.theme.textMuted}>
          {status() === 'launching'
            ? 'Please wait for controller agent to start...'
            : status() === 'failed'
            ? 'Press Escape to go back'
            : 'Starting workflow...'}
        </text>
      </box>
    </box>
  )
}
