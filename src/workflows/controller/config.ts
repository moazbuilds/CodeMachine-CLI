/**
 * Controller Configuration
 *
 * Manages controller configuration persistence in template.json.
 * Handles autonomous mode state and controller session tracking.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import type { AgentDefinition } from '../../shared/agents/config/types.js'
import { collectAgentDefinitions } from '../../shared/agents/discovery/catalog.js'
import type { ControllerConfig } from '../../shared/workflows/template.js'
import { debug } from '../../shared/logging/logger.js'

const TEMPLATE_TRACKING_FILE = 'template.json'

interface TemplateTracking {
  autonomousMode?: string // 'true' | 'false' | 'never' | 'always'
  controllerConfig?: ControllerConfig
  resumeFromLastStep?: boolean
  lastUpdated?: string
  [key: string]: unknown
}

/**
 * Get all agents with role: 'controller'
 */
export async function getControllerAgents(projectRoot: string): Promise<AgentDefinition[]> {
  debug('[Controller] getControllerAgents called with projectRoot=%s', projectRoot)
  const agents = await collectAgentDefinitions(projectRoot)
  debug('[Controller] collectAgentDefinitions returned %d agents', agents.length)
  const controllerAgents = agents.filter(agent => agent.role === 'controller')
  debug('[Controller] Found %d controller agents: %o', controllerAgents.length, controllerAgents.map(a => ({ id: a.id, role: a.role })))
  return controllerAgents
}

/**
 * Load controller configuration from template.json
 */
export async function loadControllerConfig(cmRoot: string): Promise<{
  autonomousMode: string
  controllerConfig: ControllerConfig | null
} | null> {
  debug('[Controller] loadControllerConfig called with cmRoot=%s', cmRoot)
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE)
  debug('[Controller] trackingPath=%s', trackingPath)

  if (!existsSync(trackingPath)) {
    debug('[Controller] template.json does not exist, returning null')
    return null
  }

  try {
    const content = await readFile(trackingPath, 'utf8')
    const data = JSON.parse(content) as TemplateTracking

    const result = {
      autonomousMode: data.autonomousMode ?? 'false',
      controllerConfig: data.controllerConfig ?? null,
    }
    debug('[Controller] Loaded config: autonomousMode=%s controllerConfig=%o', result.autonomousMode, result.controllerConfig)
    return result
  } catch (error) {
    debug('[Controller] Failed to load/parse template.json: %s', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Save controller configuration to template.json
 */
export async function saveControllerConfig(
  cmRoot: string,
  config: ControllerConfig,
  autonomousMode?: string
): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE)

  let data: TemplateTracking = {}

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8')
      data = JSON.parse(content) as TemplateTracking
    } catch {
      // Start fresh if parse fails
    }
  }

  // Only update autonomousMode if explicitly provided, otherwise preserve existing
  if (autonomousMode !== undefined) {
    data.autonomousMode = autonomousMode
  }
  data.controllerConfig = config
  data.lastUpdated = new Date().toISOString()
  // Ensure resumeFromLastStep is set for crash recovery
  if (data.resumeFromLastStep === undefined) {
    data.resumeFromLastStep = true
  }

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8')
}

/**
 * Set autonomous mode on/off
 * Emits workflow:mode-change event for real-time reactivity
 */
export async function setAutonomousMode(cmRoot: string, enabled: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE)

  let data: TemplateTracking = {}

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8')
      data = JSON.parse(content) as TemplateTracking
    } catch {
      // Start fresh if parse fails
    }
  }

  data.autonomousMode = enabled
  data.lastUpdated = new Date().toISOString()
  // Ensure resumeFromLastStep is set for crash recovery
  if (data.resumeFromLastStep === undefined) {
    data.resumeFromLastStep = true
  }

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8')

  // Emit mode change event for real-time reactivity
  debug('[MODE-CHANGE] Emitting workflow:mode-change event with autonomousMode=%s', enabled)
  ;(process as NodeJS.EventEmitter).emit('workflow:mode-change', { autonomousMode: enabled })
  debug('[MODE-CHANGE] Event emitted')
}

/**
 * Clear controller configuration (disable autonomous mode)
 */
export async function clearControllerConfig(cmRoot: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE)

  if (!existsSync(trackingPath)) {
    return
  }

  try {
    const content = await readFile(trackingPath, 'utf8')
    const data = JSON.parse(content) as TemplateTracking

    data.autonomousMode = 'false'
    delete data.controllerConfig
    data.lastUpdated = new Date().toISOString()

    await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8')
  } catch {
    // Ignore errors
  }
}
