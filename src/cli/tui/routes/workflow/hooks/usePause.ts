import { createSignal } from "solid-js"
import { AgentMonitorService, AgentLoggerService } from "../../../../../agents/monitoring/index.js"

/**
 * Hook for controlling workflow pause/resume
 *
 * Flow:
 * 1. User presses [P] to pause
 * 2. Emit workflow:pause event with current agent's monitoringId
 * 3. Workflow layer handles killing the process and waiting
 * 4. User presses [P] again to resume
 * 5. Emit workflow:resume event
 * 6. Workflow layer handles resuming with sessionId
 */
export function usePause() {
  const [isPaused, setIsPaused] = createSignal(false)
  const [pausedAgentId, setPausedAgentId] = createSignal<number | null>(null)

  /**
   * Toggle pause/resume state
   */
  const togglePause = () => {
    if (isPaused()) {
      resume()
    } else {
      pause()
    }
  }

  /**
   * Pause the workflow and current agent
   */
  const pause = async () => {
    // Get currently running agent
    const monitor = AgentMonitorService.getInstance()
    const activeAgents = monitor.getActiveAgents()

    if (activeAgents.length === 0) {
      // No active agent to pause
      return
    }

    // Get the most recent running agent (last in list)
    const currentAgent = activeAgents[activeAgents.length - 1]

    // Store paused agent ID for resume
    setPausedAgentId(currentAgent.id)
    setIsPaused(true)

    // Mark agent as paused BEFORE aborting
    await monitor.markPaused(currentAgent.id)

    // Write pause message to log file
    const logger = AgentLoggerService.getInstance()
    logger.write(currentAgent.id, "\n⏸️  Session paused by user. Press [P] to resume.\n")

    // Emit pause event (workflow will abort via AbortController)
    ;(process as NodeJS.EventEmitter).emit("workflow:pause")
  }

  /**
   * Resume the workflow and agent
   */
  const resume = () => {
    const monitoringId = pausedAgentId()
    if (monitoringId === null) return

    // Write resume message to log file
    const logger = AgentLoggerService.getInstance()
    logger.write(monitoringId, "\n▶️  Resuming session...\n")

    setIsPaused(false)
    setPausedAgentId(null)

    // Emit resume event with only monitoringId
    // (runner will look up sessionId from monitor)
    ;(process as NodeJS.EventEmitter).emit("workflow:resume", { monitoringId })
  }

  return {
    isPaused,
    pausedAgentId,
    togglePause,
    pause,
    resume
  }
}
