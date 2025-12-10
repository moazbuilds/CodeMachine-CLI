import { createSignal } from "solid-js"
import { AgentMonitorService, AgentLoggerService } from "../../../../../agents/monitoring/index.js"

/**
 * Hook for controlling workflow pause/resume with custom prompt
 *
 * Flow:
 * 1. User presses [P] to pause
 * 2. Emit workflow:pause event, modal opens for user input
 * 3. User enters custom prompt in modal and presses Enter
 * 4. Emit workflow:resume event with custom resumePrompt
 * 5. Workflow layer handles resuming with sessionId and custom prompt
 */
export function usePause() {
  const [isPaused, setIsPaused] = createSignal(false)
  const [pausedAgentId, setPausedAgentId] = createSignal<number | null>(null)

  /**
   * Pause the workflow and current agent
   * Returns true if pause was initiated, false if no active agent
   */
  const pause = async (): Promise<boolean> => {
    // Get currently running agent
    const monitor = AgentMonitorService.getInstance()
    const activeAgents = monitor.getActiveAgents()

    if (activeAgents.length === 0) {
      // No active agent to pause
      return false
    }

    // Get the most recent running agent (last in list)
    const currentAgent = activeAgents[activeAgents.length - 1]

    // Store paused agent ID for resume
    setPausedAgentId(currentAgent.id)
    setIsPaused(true)

    // Mark agent as paused BEFORE aborting (non-critical)
    try {
      await monitor.markPaused(currentAgent.id)
    } catch {
      // Non-critical - continue with pause
    }

    // Write pause message to log file (non-critical)
    try {
      const logger = AgentLoggerService.getInstance()
      logger.write(currentAgent.id, "\n[PAUSED] Session paused by user. Press [P] to resume.\n")
    } catch {
      // Non-critical - continue with pause
    }

    // Emit pause event (workflow will abort via AbortController)
    ;(process as NodeJS.EventEmitter).emit("workflow:pause")
    return true
  }

  /**
   * Resume the workflow and agent with custom prompt
   */
  const resumeWithPrompt = (resumePrompt?: string) => {
    const monitoringId = pausedAgentId()
    if (monitoringId === null) return

    // Write resume message to log file
    const logger = AgentLoggerService.getInstance()
    const promptDisplay = resumePrompt || '(default prompt)'
    logger.write(monitoringId, `\n[RESUMED] Resuming session with: ${promptDisplay}\n`)

    setIsPaused(false)
    setPausedAgentId(null)

    // Emit resume event with monitoringId and custom resumePrompt
    ;(process as NodeJS.EventEmitter).emit("workflow:resume", { monitoringId, resumePrompt })
  }

  /**
   * Clear pause state without emitting resume event.
   * Used when chained prompts handle the resume instead.
   */
  const clearPauseState = () => {
    setIsPaused(false)
    setPausedAgentId(null)
  }

  return {
    isPaused,
    pausedAgentId,
    pause,
    resumeWithPrompt,
    clearPauseState
  }
}
