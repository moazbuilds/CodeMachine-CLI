/**
 * Workflow Handlers
 *
 * Handlers for starting workflows and completing onboarding.
 */

import path from "path"
import { WorkflowEventBus } from "../../../workflows/events/index.js"
import { getSelectedTrack, setSelectedTrack, hasSelectedConditions, setSelectedConditions, getProjectName, setProjectName, getAutopilotAgents, initAutopilotAgent, loadAutopilotConfig } from "../../../shared/workflows/index.js"
import { loadTemplate } from "../../../workflows/templates/loader.js"
import { getTemplatePathFromTracking } from "../../../shared/workflows/template.js"
import type { TrackConfig, ConditionConfig } from "../../../workflows/templates/types"
import type { AgentDefinition } from "../../../shared/agents/config/types"

export interface OnboardRequirements {
  needsOnboard: boolean
  tracks?: Record<string, TrackConfig>
  conditions?: Record<string, ConditionConfig>
  autopilots?: AgentDefinition[]
  existingProjectName: string | null
}

/**
 * Check if onboarding is needed and get template requirements
 */
export async function checkOnboardRequirements(): Promise<OnboardRequirements> {
  const cwd = process.env.CODEMACHINE_CWD || process.cwd()
  const cmRoot = path.join(cwd, '.codemachine')

  try {
    const templatePath = await getTemplatePathFromTracking(cmRoot)
    const template = await loadTemplate(cwd, templatePath)
    const selectedTrack = await getSelectedTrack(cmRoot)
    const conditionsSelected = await hasSelectedConditions(cmRoot)
    const existingProjectName = await getProjectName(cmRoot)

    const hasTracks = template.tracks && Object.keys(template.tracks).length > 0
    const hasConditions = template.conditions && Object.keys(template.conditions).length > 0
    const needsTrackSelection = hasTracks && !selectedTrack
    const needsConditionsSelection = hasConditions && !conditionsSelected
    const needsProjectName = !existingProjectName

    // Check if workflow requires autopilot selection
    // Skip if autopilot session already exists
    let autopilots: AgentDefinition[] = []
    const existingAutopilotConfig = await loadAutopilotConfig(cmRoot)
    const hasExistingAutopilotSession = existingAutopilotConfig?.autopilotConfig?.sessionId
    const autopilotEnabled = template.autopilot?.enabled ?? template.controller === true
    if (autopilotEnabled && !hasExistingAutopilotSession) {
      autopilots = await getAutopilotAgents(cwd)
    }
    const needsAutopilotSelection = autopilots.length > 0

    const needsOnboard = needsProjectName || needsTrackSelection || needsConditionsSelection || needsAutopilotSelection

    return {
      needsOnboard,
      tracks: hasTracks ? template.tracks : undefined,
      conditions: hasConditions ? template.conditions : undefined,
      autopilots: needsAutopilotSelection ? autopilots : undefined,
      existingProjectName,
    }
  } catch (error) {
    // If template loading fails, proceed to workflow anyway
    console.error("Failed to check tracks/conditions:", error)
    return { needsOnboard: false, existingProjectName: null }
  }
}

/**
 * Create and start workflow execution
 */
export function createWorkflowExecution(): { eventBus: WorkflowEventBus; startWorkflow: () => void } {
  const eventBus = new WorkflowEventBus()
  // @ts-expect-error - global export for workflow connection
  globalThis.__workflowEventBus = eventBus

  const cwd = process.env.CODEMACHINE_CWD || process.cwd()
  const specPath = path.join(cwd, '.codemachine', 'inputs', 'specifications.md')

  const startWorkflow = () => {
    import("../../../workflows/execution/run.js").then(({ runWorkflow }) => {
      runWorkflow({ cwd, specificationPath: specPath }).catch((error) => {
        // Emit error event to show toast with actual error message
        const errorMsg = error instanceof Error ? error.message : String(error)
        ;(process as NodeJS.EventEmitter).emit('app:error', { message: errorMsg })
      })
    })
  }

  return { eventBus, startWorkflow }
}

export interface OnboardResult {
  projectName?: string
  trackId?: string
  conditions?: string[]
  autopilotAgentId?: string
}

/**
 * Save onboard results and optionally initialize autopilot
 */
export async function saveOnboardResult(
  result: OnboardResult,
  autopilotAgents: AgentDefinition[] | null,
  onLoadingChange?: (loading: boolean, message?: string) => void
): Promise<void> {
  const cwd = process.env.CODEMACHINE_CWD || process.cwd()
  const cmRoot = path.join(cwd, '.codemachine')

  // Save project name if provided
  if (result.projectName) {
    await setProjectName(cmRoot, result.projectName)
  }

  // Save selected track if provided
  if (result.trackId) {
    await setSelectedTrack(cmRoot, result.trackId)
  }

  // Always save selected conditions (even if empty array)
  if (result.conditions !== undefined) {
    await setSelectedConditions(cmRoot, result.conditions)
  }

  // Initialize autopilot agent if selected
  if (result.autopilotAgentId) {
    const agent = autopilotAgents?.find(a => a.id === result.autopilotAgentId)
    if (agent) {
      // Get prompt path from agent config (or use default)
      const promptPath = (agent.promptPath as string) || `prompts/agents/${result.autopilotAgentId}/system.md`

      // Show loading indicator while initializing autopilot agent
      onLoadingChange?.(true, "Initializing autopilot agent...")

      try {
        await initAutopilotAgent(result.autopilotAgentId, promptPath, cwd, cmRoot)
      } catch (error) {
        console.error("Failed to initialize autopilot agent:", error)
        // Continue anyway - workflow will run without autonomous mode
      } finally {
        onLoadingChange?.(false)
      }
    }
  }
}
