/**
 * Return to Controller Signal Handler
 *
 * Handles workflow:return-to-controller process events ('C' key).
 * Pauses workflow and re-enters controller conversation, then resumes.
 */

import { debug } from '../../../shared/logging/logger.js'
import { loadControllerConfig, setAutonomousMode } from '../../controller/config.js'
import { setControllerView } from '../../../shared/workflows/template.js'
import { formatUserInput } from '../../../shared/formatters/outputMarkers.js'
import { AgentLoggerService } from '../../../agents/monitoring/index.js'
import { executeAgent } from '../../../agents/runner/runner.js'
import type { SignalContext } from '../manager/types.js'

/**
 * Handle return to controller signal
 * Pauses actual workflow, enters controller conversation, then resumes
 */
export async function handleReturnToControllerSignal(ctx: SignalContext): Promise<void> {
  debug('[ReturnToControllerSignal] Signal received, state=%s', ctx.machine.state)

  // Only handle if currently executing (running, awaiting, or delegated)
  if (ctx.machine.state !== 'running' && ctx.machine.state !== 'awaiting' && ctx.machine.state !== 'delegated') {
    debug('[ReturnToControllerSignal] Ignoring - not in running/awaiting/delegated state')
    return
  }

  // Load controller config to get session info
  const controllerData = await loadControllerConfig(ctx.cmRoot)
  if (!controllerData?.controllerConfig?.sessionId) {
    debug('[ReturnToControllerSignal] No controller session found')
    return
  }

  const config = controllerData.controllerConfig
  if (!config.sessionId || !config.monitoringId || !config.agentId) {
    debug('[ReturnToControllerSignal] Missing controller config')
    return
  }

  debug('[ReturnToControllerSignal] Entering controller conversation: agentId=%s, sessionId=%s', config.agentId, config.sessionId)

  // CRITICAL: Pause the workflow state machine to stop runner from proceeding
  debug('[ReturnToControllerSignal] Pausing workflow state machine')
  ctx.machine.send({ type: 'PAUSE' })
  ctx.mode.pause()

  // Abort current step if running
  const abortController = ctx.getAbortController()
  if (abortController && !abortController.signal.aborted) {
    debug('[ReturnToControllerSignal] Aborting current step')
    abortController.abort()
  }

  // CRITICAL: Emit mode-change event to abort ControllerInputProvider
  // This must be done BEFORE switching views to ensure the controller's executeWithActions aborts
  debug('[ReturnToControllerSignal] Emitting mode-change with autonomousMode=false to abort controller')
  ;(process as NodeJS.EventEmitter).emit('workflow:mode-change', { autonomousMode: 'false' })

  // Switch to controller view
  await setControllerView(ctx.cmRoot, true)
  ctx.emitter.setWorkflowView('controller')
  ctx.emitter.updateControllerStatus('awaiting')

  // Set autonomous mode to never for conversation (file persistence)
  await setAutonomousMode(ctx.cmRoot, 'never')

  // Set input state active for controller conversation
  ctx.emitter.setInputState({
    active: true,
    monitoringId: config.monitoringId,
  })

  // Write a divider to the log with standardized format
  const divider = formatUserInput('━━━ RETURNING TO CONTROLLER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  AgentLoggerService.getInstance().write(config.monitoringId, `\n${divider}\n`)

  // Mark controller conversation as active to prevent runner from overwriting input state
  ctx.mode.setControllerConversationActive(true)

  debug('[ReturnToControllerSignal] Entering conversation loop')

  try {
    // Inlined conversation loop (replaces runControllerConversation)
    await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      ;(process as NodeJS.EventEmitter).off('workflow:input', onInput)
      ;(process as NodeJS.EventEmitter).off('workflow:controller-continue', onContinue)
    }

    const onInput = async (data: { prompt?: string; skip?: boolean }) => {
      debug('[ReturnToControllerSignal] Received input: prompt="%s" skip=%s',
        data.prompt?.slice(0, 50) ?? '(empty)', data.skip ?? false)

      // Skip signal means user wants to end controller view
      if (data.skip) {
        debug('[ReturnToControllerSignal] Skip signal - ending conversation')
        cleanup()
        resolve()
        return
      }

      // Empty prompt means user is done
      if (!data.prompt || data.prompt.trim() === '') {
        debug('[ReturnToControllerSignal] Empty prompt - ending conversation')
        cleanup()
        resolve()
        return
      }

      // Run conversation turn
      ctx.emitter.updateControllerStatus('running')
      ctx.emitter.setInputState(null)

      try {
        // Log input and execute agent (inlined from runTurn)
        // Engine/model resolved internally by executeAgent from agentConfig
        const formatted = formatUserInput(data.prompt)
        AgentLoggerService.getInstance().write(config.monitoringId, `\n${formatted}\n`)

        await executeAgent(config.agentId, data.prompt, {
          workingDir: ctx.cwd,
          resumeSessionId: config.sessionId,
          resumePrompt: data.prompt,
          resumeMonitoringId: config.monitoringId,
          engine: config.engine,
          model: config.model,
        })

        // After response, go back to awaiting input
        ctx.emitter.updateControllerStatus('awaiting')
        ctx.emitter.setInputState({
          active: true,
          monitoringId: config.monitoringId,
        })
        debug('[ReturnToControllerSignal] Turn complete, waiting for next input')
      } catch (error) {
        debug('[ReturnToControllerSignal] Error during conversation: %s', (error as Error).message)
        cleanup()
        reject(error)
      }
    }

    const onContinue = () => {
      debug('[ReturnToControllerSignal] Received controller-continue signal')
      cleanup()
      resolve()
    }

    ;(process as NodeJS.EventEmitter).on('workflow:input', onInput)
    ;(process as NodeJS.EventEmitter).on('workflow:controller-continue', onContinue)
  })
  } finally {
    // Clear controller conversation flag to allow runner to process again
    ctx.mode.setControllerConversationActive(false)
  }

  debug('[ReturnToControllerSignal] Conversation ended, resuming workflow')

  // Clear input state and switch back to executing
  ctx.emitter.setInputState(null)
  ctx.emitter.updateControllerStatus('completed')
  await setControllerView(ctx.cmRoot, false)
  ctx.emitter.setWorkflowView('executing')

  // Restore autonomous mode
  await setAutonomousMode(ctx.cmRoot, 'true')

  // CRITICAL: Resume the workflow state machine
  debug('[ReturnToControllerSignal] Resuming workflow state machine')
  ctx.mode.resume()
  ctx.machine.send({ type: 'RESUME' })
}
