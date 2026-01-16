/**
 * Workflow Events Hook
 *
 * Handles process event subscriptions for workflow lifecycle events.
 */

import { onMount, onCleanup, createSignal, type Accessor } from "solid-js"
import { OpenTUIAdapter } from "../adapters/opentui"
import { loadControllerConfig } from "../../../../../workflows/controller/config.js"
import { AgentMonitorService } from "../../../../../agents/monitoring/index.js"
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
    debug('[WORKFLOW-ERROR] Received workflow:error event, reason=%s', data.reason?.slice(0, 100) ?? '(no reason)')
    setErrorMessage(data.reason)
    debug('[WORKFLOW-ERROR] errorMessage set, isErrorModalActive=%s', errorMessage() !== null)
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

    // Load initial controller state from persisted config
    // This ensures controllerState is available on restart/resume (when controller:info event won't be re-emitted)
    const cmRoot = path.join(resolvePath(currentDir), '.codemachine')
    debug('onMount - loading controller config from: %s', cmRoot)
    const controllerState = await loadControllerConfig(cmRoot)
    debug('onMount - controllerState: %s', JSON.stringify(controllerState))

    // Set controller state in UI if we have a valid controller config
    // This enables 'C' key to return to controller even after restart/resume
    if (controllerState?.controllerConfig?.agentId) {
      debug('onMount - setting controllerState in UI from persisted config')
      // Get engine/model from MonitorService (single source of truth)
      const monitor = AgentMonitorService.getInstance()
      const monitoringId = Number(controllerState.controllerConfig.monitoringId) || undefined
      const controllerAgent = monitoringId ? monitor.getAgent(monitoringId) : undefined
      actions.setControllerState({
        id: controllerState.controllerConfig.agentId,
        name: controllerState.controllerConfig.agentId, // Name may not be persisted, use agentId as fallback
        engine: controllerAgent?.engine ?? 'unknown',
        model: controllerAgent?.modelName,
        telemetry: { tokensIn: 0, tokensOut: 0 }, // Default telemetry, will be updated if controller runs
        monitoringId,
      })
    }

    // Set autonomous mode from file if present
    // Note: autonomousMode is a string, so we check the value is valid, not truthy
    if (controllerState?.autonomousMode && ['true', 'false', 'never', 'always'].includes(controllerState.autonomousMode)) {
      debug('onMount - setting autonomousMode to %s', controllerState.autonomousMode)
      actions.setAutonomousMode(controllerState.autonomousMode as AutonomousMode)
    } else {
      // No config or invalid value - default to 'false' (no AUTO display)
      debug('onMount - autonomousMode not set in config or invalid value, defaulting to false')
      actions.setAutonomousMode('false')
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
