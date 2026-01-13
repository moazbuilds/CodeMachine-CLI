/**
 * Workflow Handlers Hook
 *
 * Provides action handlers for workflow interactions.
 */

import { createSignal, type Accessor } from "solid-js"
import { setAutonomousMode as persistAutonomousMode, loadControllerConfig } from "../../../../../shared/workflows/index.js"
import { debug } from "../../../../../shared/logging/logger.js"
import path from "path"
import type { UIActions, AutonomousMode } from "../context/ui-state/types"

/** Expand ~ to home directory if present */
const resolvePath = (dir: string): string =>
  dir.startsWith('~') ? dir.replace('~', process.env.HOME || '') : dir

export interface UseWorkflowHandlersOptions {
  currentDir: string
  actions: UIActions
  showToast: (variant: "success" | "error" | "info" | "warning", message: string, duration?: number) => void
  isWaitingForInput: Accessor<boolean>
  isOnboardingPhase: Accessor<boolean>
}

export interface UseWorkflowHandlersResult {
  // Stop modal
  showStopModal: Accessor<boolean>
  setShowStopModal: (show: boolean) => void
  handleStopConfirm: () => void
  handleStopCancel: () => void

  // Controller continue modal
  showControllerContinueModal: Accessor<boolean>
  setShowControllerContinueModal: (show: boolean) => void
  handleControllerContinueConfirm: () => void
  handleControllerContinueCancel: () => void

  // Prompt box focus
  isPromptBoxFocused: Accessor<boolean>
  setIsPromptBoxFocused: (focused: boolean) => void

  // Prompt handlers
  handlePromptSubmit: (prompt: string) => void
  handleSkip: () => void

  // Workflow control
  pauseWorkflow: () => void
  toggleAutonomousMode: () => Promise<void>

  // Checkpoint handlers
  handleCheckpointContinue: () => void
  handleCheckpointQuit: () => void

  // Return to controller
  returnToController: () => void
}

export function useWorkflowHandlers(options: UseWorkflowHandlersOptions): UseWorkflowHandlersResult {
  const { currentDir, actions, showToast, isWaitingForInput, isOnboardingPhase } = options

  // Stop confirmation modal state
  const [showStopModal, setShowStopModal] = createSignal(false)

  // Controller continue confirmation modal state
  const [showControllerContinueModal, setShowControllerContinueModal] = createSignal(false)

  // Prompt box focus state
  const [isPromptBoxFocused, setIsPromptBoxFocused] = createSignal(true)

  // Stop handlers
  const handleStopConfirm = () => {
    setShowStopModal(false)
    ;(process as NodeJS.EventEmitter).emit("workflow:user-stop")
    ;(process as NodeJS.EventEmitter).emit("workflow:stop")
    ;(process as NodeJS.EventEmitter).emit("workflow:return-home")
  }

  const handleStopCancel = () => {
    setShowStopModal(false)
  }

  // Controller continue handlers
  const handleControllerContinueConfirm = () => {
    setShowControllerContinueModal(false)
    ;(process as NodeJS.EventEmitter).emit('workflow:controller-continue')
  }

  const handleControllerContinueCancel = () => {
    setShowControllerContinueModal(false)
    setIsPromptBoxFocused(true)
  }

  // Prompt submit handler
  const handlePromptSubmit = (prompt: string) => {
    if (isWaitingForInput()) {
      // In onboarding phase, empty prompt shows confirmation dialog
      if (isOnboardingPhase() && (!prompt || prompt.trim() === '')) {
        debug('Empty prompt in onboarding phase - showing confirmation dialog')
        setShowControllerContinueModal(true)
        return
      }
      ;(process as NodeJS.EventEmitter).emit("workflow:input", { prompt: prompt || undefined })
      setIsPromptBoxFocused(false)
    }
  }

  // Skip handler
  const handleSkip = () => {
    if (isWaitingForInput()) {
      ;(process as NodeJS.EventEmitter).emit("workflow:input", { skip: true })
      setIsPromptBoxFocused(false)
    }
  }

  // Pause workflow
  const pauseWorkflow = () => {
    ;(process as NodeJS.EventEmitter).emit("workflow:pause")
  }

  // Toggle autonomous mode
  const toggleAutonomousMode = async () => {
    const cmRoot = path.join(resolvePath(currentDir), '.codemachine')

    const controllerState = await loadControllerConfig(cmRoot)
    debug('[TOGGLE] controllerState: %s', JSON.stringify(controllerState))

    const currentMode = controllerState?.autonomousMode ?? 'true'

    // Prevent toggle if locked
    if (currentMode === 'never' || currentMode === 'always') {
      showToast("warning", "Autonomous mode is locked by workflow configuration", 3000)
      return
    }

    const newMode = currentMode === 'true' ? 'false' : 'true'
    debug('[TOGGLE] Current mode from file: %s, new mode: %s', currentMode, newMode)

    // Update UI state
    actions.setAutonomousMode(newMode)

    // Persist to file
    try {
      await persistAutonomousMode(cmRoot, newMode)
      debug('[TOGGLE] Successfully persisted autonomousMode=%s', newMode)
      showToast(
        newMode === 'true' ? "success" : "warning",
        newMode === 'true' ? "Autonomous mode enabled" : "Autonomous mode disabled",
        3000
      )
    } catch (err) {
      debug('[TOGGLE] Failed to persist autonomousMode: %s', err)
      actions.setAutonomousMode(currentMode as AutonomousMode)
      showToast("error", "Failed to toggle autonomous mode", 3000)
    }
  }

  // Checkpoint handlers
  const handleCheckpointContinue = () => {
    actions.setCheckpointState(null)
    actions.setWorkflowStatus("running")
    ;(process as NodeJS.EventEmitter).emit("checkpoint:continue")
  }

  const handleCheckpointQuit = () => {
    actions.setCheckpointState(null)
    actions.setWorkflowStatus("stopped")
    ;(process as NodeJS.EventEmitter).emit("checkpoint:quit")
  }

  // Return to controller
  const returnToController = () => {
    debug('Returning to controller - emitting workflow:return-to-controller')
    ;(process as NodeJS.EventEmitter).emit('workflow:return-to-controller')
  }

  return {
    showStopModal,
    setShowStopModal,
    handleStopConfirm,
    handleStopCancel,
    showControllerContinueModal,
    setShowControllerContinueModal,
    handleControllerContinueConfirm,
    handleControllerContinueCancel,
    isPromptBoxFocused,
    setIsPromptBoxFocused,
    handlePromptSubmit,
    handleSkip,
    pauseWorkflow,
    toggleAutonomousMode,
    handleCheckpointContinue,
    handleCheckpointQuit,
    returnToController
  }
}
