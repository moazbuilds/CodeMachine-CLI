/**
 * Workflow Events Hook
 *
 * Handles process event subscriptions for workflow lifecycle events.
 */

import { onMount, onCleanup, createSignal, type Accessor } from "solid-js"
import { OpenTUIAdapter } from "../adapters/opentui"
import { loadControllerConfig } from "../../../../../shared/workflows/index.js"
import { debug } from "../../../../../shared/logging/logger.js"
import path from "path"
import type { WorkflowEventBus } from "../../../../../workflows/events/index.js"
import type { UIActions, AutonomousMode } from "../context/ui-state/types"

/** Expand ~ to home directory if present */
const resolvePath = (dir: string): string =>
  dir.startsWith('~') ? dir.replace('~', process.env.HOME || '') : dir

export interface UseWorkflowEventsOptions {
  currentDir: string
  eventBus?: WorkflowEventBus | null
  actions: UIActions
  showToast: (variant: "success" | "error" | "info" | "warning", message: string) => void
  onAdapterReady?: () => void
}

export interface UseWorkflowEventsResult {
  errorMessage: Accessor<string | null>
  setErrorMessage: (msg: string | null) => void
  isErrorModalActive: Accessor<boolean>
}

export function useWorkflowEvents(options: UseWorkflowEventsOptions): UseWorkflowEventsResult {
  const { currentDir, eventBus, actions, showToast, onAdapterReady } = options

  // Error modal state
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const isErrorModalActive = () => errorMessage() !== null

  // Event handlers
  const handleStopping = () => {
    actions.setWorkflowStatus("stopping")
  }

  const handleUserStop = () => {
    actions.setWorkflowStatus("stopped")
  }

  const handleWorkflowError = (data: { reason: string }) => {
    setErrorMessage(data.reason)
  }

  const handleModeChange = (data: { autonomousMode: string }) => {
    debug('[MODE-CHANGE] Received event: autonomousMode=%s', data.autonomousMode)
    if (['true', 'false', 'never', 'always'].includes(data.autonomousMode)) {
      actions.setAutonomousMode(data.autonomousMode as AutonomousMode)
    }
  }

  // Adapter reference
  let adapter: OpenTUIAdapter | null = null

  onMount(async () => {
    ;(process as NodeJS.EventEmitter).on('workflow:error', handleWorkflowError)
    ;(process as NodeJS.EventEmitter).on('workflow:stopping', handleStopping)
    ;(process as NodeJS.EventEmitter).on('workflow:user-stop', handleUserStop)
    ;(process as NodeJS.EventEmitter).on('workflow:mode-change', handleModeChange)

    // Load initial autonomous mode state
    const cmRoot = path.join(resolvePath(currentDir), '.codemachine')
    debug('onMount - loading controller config from: %s', cmRoot)
    const controllerState = await loadControllerConfig(cmRoot)
    debug('onMount - controllerState: %s', JSON.stringify(controllerState))

    // Set autonomous mode from file if present, otherwise default is 'true'
    if (controllerState?.autonomousMode) {
      debug('onMount - setting autonomousMode to %s', controllerState.autonomousMode)
      if (['true', 'false', 'never', 'always'].includes(controllerState.autonomousMode)) {
        actions.setAutonomousMode(controllerState.autonomousMode as AutonomousMode)
      }
    } else {
      debug('onMount - autonomousMode not enabled in config, using default (true)')
    }

    if (eventBus) {
      const actionsWithToast = {
        ...actions,
        showToast
      }
      adapter = new OpenTUIAdapter({ actions: actionsWithToast })
      adapter.connect(eventBus)
      adapter.start()
      onAdapterReady?.()
    }
  })

  onCleanup(() => {
    ;(process as NodeJS.EventEmitter).off('workflow:error', handleWorkflowError)
    ;(process as NodeJS.EventEmitter).off('workflow:stopping', handleStopping)
    ;(process as NodeJS.EventEmitter).off('workflow:user-stop', handleUserStop)
    ;(process as NodeJS.EventEmitter).off('workflow:mode-change', handleModeChange)
    if (adapter) {
      adapter.stop()
      adapter.disconnect()
    }
  })

  return {
    errorMessage,
    setErrorMessage,
    isErrorModalActive
  }
}
