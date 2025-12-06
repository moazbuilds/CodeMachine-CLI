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
   * Resume the workflow and agent with custom prompt
   */
  const resumeWithPrompt = (resumePrompt?: string) => {
    const monitoringId = pausedAgentId()
    if (monitoringId === null) return

    // Write resume message to log file
    const logger = AgentLoggerService.getInstance()
    const promptPreview = resumePrompt ? resumePrompt.slice(0, 50) + (resumePrompt.length > 50 ? '...' : '') : 'default'
    logger.write(monitoringId, `\n▶️  Resuming session with: ${promptPreview}\n`)

    // DEBUG
    console.error(`[DEBUG usePause] resumeWithPrompt called with: "${resumePrompt}"`)

    setIsPaused(false)
    setPausedAgentId(null)

    // Emit resume event with monitoringId and custom resumePrompt
    ;(process as NodeJS.EventEmitter).emit("workflow:resume", { monitoringId, resumePrompt })
  }

  return {
    isPaused,
    pausedAgentId,
    pause,
    resumeWithPrompt
  }
}
