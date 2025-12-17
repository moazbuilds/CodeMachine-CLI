import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { AgentDefinition } from '../agents/config/types.js';
import { collectAgentDefinitions } from '../agents/discovery/catalog.js';
import type { AutopilotConfig } from './template.js';
import { executeAgent } from '../../agents/runner/runner.js';
import { AgentMonitorService } from '../../agents/monitoring/index.js';
import { processPromptString } from '../prompts/index.js';

const TEMPLATE_TRACKING_FILE = 'template.json';

interface TemplateTracking {
  autonomousMode?: boolean;
  autopilotConfig?: AutopilotConfig;
  // Legacy field for migration
  controllerConfig?: AutopilotConfig;
  [key: string]: unknown;
}

/**
 * Autopilot action types
 */
export type AutopilotAction = 'NEXT' | 'SKIP' | 'STOP' | 'CONTINUE' | 'LOOP' | 'WAIT';

/**
 * Get all agents with role: 'controller' (autopilot agents)
 */
export async function getAutopilotAgents(projectRoot: string): Promise<AgentDefinition[]> {
  const agents = await collectAgentDefinitions(projectRoot);
  return agents.filter(agent => agent.role === 'controller');
}

/**
 * Initialize autopilot agent session
 * Called at onboard time to create persistent session for the workflow
 */
export async function initAutopilotAgent(
  agentId: string,
  promptPath: string,
  cwd: string,
  cmRoot: string
): Promise<AutopilotConfig> {
  // Load prompt from MD file (same as other agents)
  const resolvedPath = path.isAbsolute(promptPath) ? promptPath : path.resolve(cwd, promptPath);
  const rawPrompt = await readFile(resolvedPath, 'utf8');
  const prompt = await processPromptString(rawPrompt, cwd);

  // Execute agent via normal flow (creates monitoring entry, session, etc.)
  const result = await executeAgent(agentId, prompt, {
    workingDir: cwd,
  });

  // Get sessionId from monitoring service
  const monitor = AgentMonitorService.getInstance();
  const agent = monitor.getAgent(result.agentId!);

  if (!agent?.sessionId) {
    throw new Error(`Failed to get session ID for autopilot agent: ${agentId}`);
  }

  // Build config
  const config: AutopilotConfig = {
    agentId,
    sessionId: agent.sessionId,
    monitoringId: result.agentId!,
  };

  // Save to template.json
  await saveAutopilotConfig(cmRoot, config);

  return config;
}

/**
 * Load autopilot configuration from template.json
 * Includes migration from old 'controllerConfig' format
 */
export async function loadAutopilotConfig(cmRoot: string): Promise<{
  autonomousMode: boolean;
  autopilotConfig: AutopilotConfig | null;
} | null> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return null;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;

    // Migration: convert old controllerConfig to autopilotConfig
    if (data.controllerConfig && !data.autopilotConfig) {
      data.autopilotConfig = data.controllerConfig;
      delete data.controllerConfig;
      data.lastUpdated = new Date().toISOString();
      // Save migrated data
      await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
    }

    return {
      autonomousMode: data.autonomousMode ?? false,
      autopilotConfig: data.autopilotConfig ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Save autopilot configuration to template.json
 */
export async function saveAutopilotConfig(
  cmRoot: string,
  config: AutopilotConfig,
  autonomousMode = true
): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  let data: TemplateTracking = {};

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8');
      data = JSON.parse(content) as TemplateTracking;
    } catch {
      // Start fresh if parse fails
    }
  }

  data.autonomousMode = autonomousMode;
  data.autopilotConfig = config;
  // Remove legacy field if present
  delete data.controllerConfig;
  data.lastUpdated = new Date().toISOString();

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Set autonomous mode on/off
 * Emits workflow:mode-change event for real-time reactivity
 */
export async function setAutonomousMode(cmRoot: string, enabled: boolean): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  let data: TemplateTracking = {};

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8');
      data = JSON.parse(content) as TemplateTracking;
    } catch {
      // Start fresh if parse fails
    }
  }

  data.autonomousMode = enabled;
  data.lastUpdated = new Date().toISOString();

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');

  // Emit mode change event for real-time reactivity
  const { debug } = await import('../logging/logger.js');
  debug('[MODE-CHANGE] Emitting workflow:mode-change event with autonomousMode=%s', enabled);
  (process as NodeJS.EventEmitter).emit('workflow:mode-change', { autonomousMode: enabled });
  debug('[MODE-CHANGE] Event emitted');
}

/**
 * Clear autopilot configuration (disable autonomous mode)
 */
export async function clearAutopilotConfig(cmRoot: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;

    data.autonomousMode = false;
    delete data.autopilotConfig;
    delete data.controllerConfig; // Remove legacy field too
    data.lastUpdated = new Date().toISOString();

    await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Ignore errors
  }
}

/**
 * Parse autopilot response for action commands
 *
 * Actions:
 * - NEXT: Advance to next step (mark current complete)
 * - CONTINUE: Resume agent with empty input (let it keep working)
 * - SKIP: Skip remaining prompts, advance to next step
 * - STOP: Stop the workflow
 * - LOOP: Re-run current step from beginning
 * - WAIT: Switch to manual mode, wait for user input
 */
export function parseAutopilotAction(output: string): AutopilotAction | null {
  if (output.includes('ACTION: NEXT')) return 'NEXT';
  if (output.includes('ACTION: CONTINUE')) return 'CONTINUE';
  if (output.includes('ACTION: SKIP')) return 'SKIP';
  if (output.includes('ACTION: STOP')) return 'STOP';
  if (output.includes('ACTION: LOOP')) return 'LOOP';
  if (output.includes('ACTION: WAIT')) return 'WAIT';
  return null;
}

/**
 * Extract clean input text from autopilot response
 * Removes:
 * - ACTION: commands
 * - Color markers like [CYAN], [GREEN:BOLD], [GRAY], etc.
 * - Status lines like "> OpenCode is analyzing..."
 */
export function extractInputText(output: string): string {
  let cleaned = output
    // Remove ACTION commands (including new ones)
    .replace(/ACTION:\s*(NEXT|SKIP|STOP|CONTINUE|LOOP|WAIT)/g, '')
    // Remove color markers like [CYAN], [GREEN:BOLD], [GRAY], [RUNNING], etc.
    .replace(/\[(CYAN|GREEN|GRAY|RED|YELLOW|MAGENTA|BLUE|WHITE|BLACK|RUNNING|DIM|BOLD|RESET)(:[A-Z]+)?\]/gi, '')
    // Remove "* " thinking prefix from streaming
    .replace(/^\s*\*\s*/gm, '')
    // Remove status lines
    .replace(/>\s*OpenCode is analyzing[^\n]*/gi, '')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

// Legacy aliases for backwards compatibility during migration
/** @deprecated Use getAutopilotAgents instead */
export const getControllerAgents = getAutopilotAgents;
/** @deprecated Use initAutopilotAgent instead */
export const initControllerAgent = initAutopilotAgent;
/** @deprecated Use loadAutopilotConfig instead */
export const loadControllerConfig = loadAutopilotConfig;
/** @deprecated Use saveAutopilotConfig instead */
export const saveControllerConfig = saveAutopilotConfig;
/** @deprecated Use clearAutopilotConfig instead */
export const clearControllerConfig = clearAutopilotConfig;
/** @deprecated Use parseAutopilotAction instead */
export const parseControllerAction = parseAutopilotAction;
