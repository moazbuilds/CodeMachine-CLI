import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { AgentDefinition } from '../agents/config/types.js';
import { collectAgentDefinitions } from '../agents/discovery/catalog.js';
import type { ControllerConfig } from './template.js';
import { executeAgent } from '../../agents/runner/runner.js';
import { AgentMonitorService } from '../../agents/monitoring/index.js';
import { processPromptString } from '../prompts/index.js';

const TEMPLATE_TRACKING_FILE = 'template.json';

interface TemplateTracking {
  autonomousMode?: boolean;
  controllerConfig?: ControllerConfig;
  [key: string]: unknown;
}

/**
 * Get all agents with role: 'controller'
 */
export async function getControllerAgents(projectRoot: string): Promise<AgentDefinition[]> {
  const agents = await collectAgentDefinitions(projectRoot);
  return agents.filter(agent => agent.role === 'controller');
}

/**
 * Initialize controller agent session
 * Called at onboard time to create persistent session for the workflow
 */
export async function initControllerAgent(
  agentId: string,
  promptPath: string,
  cwd: string,
  cmRoot: string
): Promise<ControllerConfig> {
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
    throw new Error(`Failed to get session ID for controller agent: ${agentId}`);
  }

  // Build config
  const config: ControllerConfig = {
    agentId,
    sessionId: agent.sessionId,
    monitoringId: result.agentId!,
  };

  // Save to template.json
  await saveControllerConfig(cmRoot, config);

  return config;
}

/**
 * Load controller configuration from template.json
 */
export async function loadControllerConfig(cmRoot: string): Promise<{
  autonomousMode: boolean;
  controllerConfig: ControllerConfig | null;
} | null> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return null;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    return {
      autonomousMode: data.autonomousMode ?? false,
      controllerConfig: data.controllerConfig ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Save controller configuration to template.json
 */
export async function saveControllerConfig(
  cmRoot: string,
  config: ControllerConfig,
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
  data.controllerConfig = config;
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
 * Clear controller configuration (disable autonomous mode)
 */
export async function clearControllerConfig(cmRoot: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;

    data.autonomousMode = false;
    delete data.controllerConfig;
    data.lastUpdated = new Date().toISOString();

    await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Ignore errors
  }
}

/**
 * Parse controller response for action commands
 */
export function parseControllerAction(output: string): 'NEXT' | 'SKIP' | 'STOP' | null {
  if (output.includes('ACTION: NEXT')) return 'NEXT';
  if (output.includes('ACTION: SKIP')) return 'SKIP';
  if (output.includes('ACTION: STOP')) return 'STOP';
  return null;
}

/**
 * Extract clean input text from controller response
 * Removes:
 * - ACTION: commands
 * - Color markers like [CYAN], [GREEN:BOLD], [GRAY], etc.
 * - Status lines like "> OpenCode is analyzing..."
 */
export function extractInputText(output: string): string {
  let cleaned = output
    // Remove ACTION commands
    .replace(/ACTION:\s*(NEXT|SKIP|STOP)/g, '')
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
