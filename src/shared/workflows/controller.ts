import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { AgentDefinition } from '../agents/config/types.js';
import { collectAgentDefinitions } from '../agents/discovery/catalog.js';
import type { ControllerConfig } from './template.js';
import { executeAgent } from '../../agents/runner/runner.js';
import { AgentMonitorService } from '../../agents/monitoring/index.js';
import { processPromptString } from '../prompts/index.js';
import { debug } from '../logging/logger.js';

const TEMPLATE_TRACKING_FILE = 'template.json';

interface TemplateTracking {
  autonomousMode?: boolean;
  controllerConfig?: ControllerConfig;
  resumeFromLastStep?: boolean;
  lastUpdated?: string;
  [key: string]: unknown;
}

/**
 * Get all agents with role: 'controller'
 */
export async function getControllerAgents(projectRoot: string): Promise<AgentDefinition[]> {
  debug('[Controller] getControllerAgents called with projectRoot=%s', projectRoot);
  const agents = await collectAgentDefinitions(projectRoot);
  debug('[Controller] collectAgentDefinitions returned %d agents', agents.length);
  const controllerAgents = agents.filter(agent => agent.role === 'controller');
  debug('[Controller] Found %d controller agents: %o', controllerAgents.length, controllerAgents.map(a => ({ id: a.id, role: a.role })));
  return controllerAgents;
}

/**
 * Options for controller agent initialization
 */
export interface InitControllerOptions {
  /** Callback when monitoring ID becomes available (for log streaming) */
  onMonitoringId?: (monitoringId: number) => void;
}

/**
 * Initialize controller agent session
 * Called at onboard time to create persistent session for the workflow
 */
export async function initControllerAgent(
  agentId: string,
  promptPath: string | string[],
  cwd: string,
  cmRoot: string,
  options?: InitControllerOptions
): Promise<ControllerConfig> {
  debug('[Controller] initControllerAgent called: agentId=%s promptPath=%o cwd=%s cmRoot=%s', agentId, promptPath, cwd, cmRoot);

  // Handle both single path and array of paths
  const promptPaths = Array.isArray(promptPath) ? promptPath : [promptPath];
  debug('[Controller] Prompt paths to load: %o', promptPaths);

  // Load and combine all prompt files
  const promptParts: string[] = [];
  for (const p of promptPaths) {
    const resolvedPath = path.isAbsolute(p) ? p : path.resolve(cwd, p);
    debug('[Controller] Resolved prompt path: %s', resolvedPath);

    const promptExists = existsSync(resolvedPath);
    debug('[Controller] Prompt file exists: %s', promptExists);
    if (!promptExists) {
      throw new Error(`Prompt file not found: ${resolvedPath}`);
    }

    const content = await readFile(resolvedPath, 'utf8');
    debug('[Controller] Read prompt file %s, length=%d', resolvedPath, content.length);
    promptParts.push(content);
  }

  const rawPrompt = promptParts.join('\n\n');
  debug('[Controller] Combined raw prompt, length=%d', rawPrompt.length);
  const prompt = await processPromptString(rawPrompt, cwd);
  debug('[Controller] Processed prompt, length=%d', prompt.length);

  // Execute agent via normal flow (creates monitoring entry, session, etc.)
  debug('[Controller] Calling executeAgent...');

  // Create UI interface to capture monitoring ID early (for log streaming)
  const ui = options?.onMonitoringId ? {
    registerMonitoringId: (_uiAgentId: string, monitoringAgentId: number) => {
      debug('[Controller] Received monitoringId=%d, invoking callback', monitoringAgentId);
      options.onMonitoringId!(monitoringAgentId);
    }
  } : undefined;

  const result = await executeAgent(agentId, prompt, {
    workingDir: cwd,
    ui,
    uniqueAgentId: agentId, // Required for ui callback to work
  });
  debug('[Controller] executeAgent returned: agentId=%s', result.agentId);

  // Get sessionId from monitoring service
  const monitor = AgentMonitorService.getInstance();
  const agent = monitor.getAgent(result.agentId!);
  debug('[Controller] Monitor agent: %o', agent ? { id: agent.id, sessionId: agent.sessionId } : null);

  if (!agent?.sessionId) {
    debug('[Controller] ERROR: No session ID for controller agent');
    throw new Error(`Failed to get session ID for controller agent: ${agentId}`);
  }

  // Build config
  const config: ControllerConfig = {
    agentId,
    sessionId: agent.sessionId,
    monitoringId: result.agentId!,
  };
  debug('[Controller] Built config: %o', config);

  // Save to template.json
  debug('[Controller] Saving controller config to template.json...');
  await saveControllerConfig(cmRoot, config);
  debug('[Controller] Controller config saved successfully');

  return config;
}

/**
 * Load controller configuration from template.json
 */
export async function loadControllerConfig(cmRoot: string): Promise<{
  autonomousMode: boolean;
  controllerConfig: ControllerConfig | null;
} | null> {
  debug('[Controller] loadControllerConfig called with cmRoot=%s', cmRoot);
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);
  debug('[Controller] trackingPath=%s', trackingPath);

  if (!existsSync(trackingPath)) {
    debug('[Controller] template.json does not exist, returning null');
    return null;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    const result = {
      autonomousMode: data.autonomousMode ?? false,
      controllerConfig: data.controllerConfig ?? null,
    };
    debug('[Controller] Loaded config: autonomousMode=%s controllerConfig=%o', result.autonomousMode, result.controllerConfig);
    return result;
  } catch (error) {
    debug('[Controller] Failed to load/parse template.json: %s', error instanceof Error ? error.message : String(error));
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
  // Ensure resumeFromLastStep is set for crash recovery
  if (data.resumeFromLastStep === undefined) {
    data.resumeFromLastStep = true;
  }

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
  // Ensure resumeFromLastStep is set for crash recovery
  if (data.resumeFromLastStep === undefined) {
    data.resumeFromLastStep = true;
  }

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

// ─────────────────────────────────────────────────────────────────
// Action Parsing (re-exported from agents/execution for backward compatibility)
// ─────────────────────────────────────────────────────────────────

/**
 * @deprecated Use parseAction from '../../agents/execution/index.js' instead
 */
export { parseAction as parseControllerAction } from '../../agents/execution/actions.js';

/**
 * @deprecated Use extractCleanText from '../../agents/execution/index.js' instead
 */
export { extractCleanText as extractInputText } from '../../agents/execution/actions.js';

// Export the new generic type for forward compatibility
export type { AgentAction } from '../../agents/execution/types.js';
